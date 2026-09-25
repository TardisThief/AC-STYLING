"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/app/lib/auth-guards";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/app/lib/errors";
import { deriveStoragePath, signWardrobeItems } from "@/lib/wardrobe-images";
import { wardrobeUploadPath } from "@/lib/wardrobe-paths";
import { parseInput, uuid } from "@/app/lib/validation/parse";
import { adminWardrobeItemUpdateSchema, bulkStatusSchema } from "@/app/lib/validation/wardrobe-items";
import { wardrobeUpdateSchema } from "@/app/lib/validation/wardrobes";
import type { WardrobeItem } from "@/app/lib/types";
import { MAX_ITEMS_PER_WARDROBE, uploadTokenExpiry } from '@/app/lib/wardrobe-tokens';

// =============================================================================
// Types
// =============================================================================

export interface Wardrobe {
    id: string;
    owner_id: string | null;
    title: string;
    upload_token: string;
    status: 'active' | 'archived';
    created_at: string;
    updated_at: string;
    profiles?: {
        full_name: string | null;
        email: string | null;
    };
    item_count?: number;
}

// =============================================================================
// Admin: Get All Wardrobes (with owner info)
// =============================================================================

export async function getWardrobes(): Promise<{
    success: boolean;
    data?: Wardrobe[];
    error?: string;
}> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const supabase = auth.supabase;

    const { data, error } = await supabase
        .from('wardrobes')
        .select(`
            *,
            profiles:owner_id (full_name, email)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching wardrobes:', error);
        return { success: false, error: error.message };
    }

    return { success: true, data: data as Wardrobe[] };
}

// =============================================================================
// Admin: Create Wardrobe (for new client or project)
// =============================================================================

export async function createWardrobe(
    title: string,
    ownerId?: string // Optional - if null, admin-managed
): Promise<{
    success: boolean;
    wardrobe?: Wardrobe;
    error?: string;
}> {
    try {
        const auth = await requireAdmin();
        if (!auth.ok) return { success: false, error: auth.error };

        const adminSupabase = createAdminClient();

        const { data, error } = await adminSupabase
            .from('wardrobes')
            .insert({
                title,
                owner_id: ownerId || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating wardrobe:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/vault/studio');
        return { success: true, wardrobe: data as Wardrobe };
    } catch (error) {
        console.error("Critical Error in createWardrobe:", error);
        return { success: false, error: getErrorMessage(error) || "Internal Server Error" };
    }
}

// =============================================================================
// Admin: Update Wardrobe
// =============================================================================

export async function updateWardrobe(
    wardrobeId: string,
    updates: { title?: string; owner_id?: string | null; status?: 'active' | 'archived' }
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsedId = parseInput(uuid('Wardrobe id'), wardrobeId);
    if (!parsedId.ok) return { success: false, error: parsedId.error };

    // The type above is not checked at runtime; a caller can send any object.
    const parsed = parseInput(wardrobeUpdateSchema, updates);
    if (!parsed.ok) return { success: false, error: parsed.error };
    if (Object.keys(parsed.data).length === 0) return { success: false, error: 'Nothing to update' };

    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
        .from('wardrobes')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', parsedId.data);

    if (error) {
        console.error('Error updating wardrobe:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/studio');
    return { success: true };
}

// =============================================================================
// Get Wardrobe by Upload Token (for guest uploads)
// =============================================================================

export async function getWardrobeByToken(token: string): Promise<{
    success: boolean;
    wardrobe?: Wardrobe;
    error?: string;
}> {
    // Use admin client to bypass RLS for token lookup
    const supabase = createAdminClient();

    const resolved = await resolveWardrobeByToken(supabase, token);
    if (!resolved.ok) return { success: false, error: resolved.error };

    const { data, error } = await supabase
        .from('wardrobes')
        .select('*')
        .eq('id', resolved.wardrobe!.id)
        .single();

    if (error || !data) {
        return { success: false, error: "Invalid or expired upload link" };
    }

    return { success: true, wardrobe: data as Wardrobe };
}

// =============================================================================
// Direct Upload Flow (bypasses Vercel serverless limits)
// =============================================================================

interface TokenLookup {
    ok: boolean;
    wardrobe?: { id: string; owner_id: string | null };
    error?: string;
}

/**
 * Resolve an intake token to its wardrobe, or explain why not.
 *
 * Every token-accepting entry point goes through here. Five call sites
 * previously repeated the same `.eq('upload_token', ...)` lookup, which is
 * exactly the shape where one gets missed when a rule like expiry is added.
 *
 * A null `upload_token_expires_at` is treated as "no expiry" so a row that
 * predates migration 16 fails open rather than locking a client out. Every
 * path that issues a token now sets one.
 */
async function resolveWardrobeByToken(
    supabase: ReturnType<typeof createAdminClient>,
    token: string,
    { requireActive = true }: { requireActive?: boolean } = {}
): Promise<TokenLookup> {
    let query = supabase
        .from('wardrobes')
        .select('id, owner_id, status, upload_token_expires_at')
        .eq('upload_token', token);

    if (requireActive) query = query.eq('status', 'active');

    const { data, error } = await query.single();

    if (error || !data) return { ok: false, error: "Invalid or expired upload link" };

    const expiresAt = data.upload_token_expires_at as string | null;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        // Said plainly, because unlike a bad token this is recoverable: the
        // stylist can issue a new link.
        return { ok: false, error: "This upload link has expired. Ask for a new one." };
    }

    return { ok: true, wardrobe: { id: data.id as string, owner_id: data.owner_id as string | null } };
}

/**
 * Has this wardrobe hit its item cap?
 *
 * Counted rather than stored: the number of items IS the count, and a separate
 * counter would be one more thing to drift.
 */
async function isWardrobeFull(
    supabase: ReturnType<typeof createAdminClient>,
    wardrobeId: string
): Promise<boolean> {
    const { count, error } = await supabase
        .from('wardrobe_items')
        .select('id', { count: 'exact', head: true })
        .eq('wardrobe_id', wardrobeId);

    // Fail open on a counting error: refusing a legitimate upload because a
    // COUNT failed is worse than briefly exceeding a deliberately loose cap.
    if (error) {
        console.error('[wardrobes] item count failed:', error.message);
        return false;
    }

    return (count ?? 0) >= MAX_ITEMS_PER_WARDROBE;
}

/**
 * Step 1: Get a signed URL for direct browser → Supabase Storage upload
 * This validates the token and returns a URL the client can upload to directly
 */
export async function getSignedUploadUrl(
    token: string,
    fileName: string
): Promise<{ success: boolean; signedUrl?: string; filePath?: string; error?: string }> {
    const supabase = createAdminClient();

    // 1. Validate token (existence, active status and expiry)
    const resolved = await resolveWardrobeByToken(supabase, token);
    if (!resolved.ok) return { success: false, error: resolved.error };
    const wardrobe = resolved.wardrobe!;

    // 2. Refuse once the wardrobe is full, before minting an upload URL.
    if (await isWardrobeFull(supabase, wardrobe.id)) {
        return { success: false, error: "This wardrobe has reached its upload limit." };
    }

    try {
        // 3. Generate unique file path
        const fileExt = fileName.split('.').pop() || 'jpg';
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `wardrobe/${wardrobe.id}/${uniqueName}`;

        // 3. Create signed upload URL (valid for 5 minutes)
        const { data, error: signError } = await supabase.storage
            .from('studio-wardrobe')
            .createSignedUploadUrl(filePath);

        if (signError || !data) {
            throw signError || new Error("Failed to create upload URL");
        }

        return {
            success: true,
            signedUrl: data.signedUrl,
            filePath: filePath
        };

    } catch (error) {
        console.error("Signed URL Error:", error);
        return { success: false, error: getErrorMessage(error) || "Failed to prepare upload" };
    }
}

/**
 * Is this storage path one that an upload for this wardrobe could have used?
 *
 * Accepts the guest-intake folder `wardrobe/<id>/…` that `getSignedUploadUrl`
 * issues, and the owner folder `<ownerId>/…` that owned wardrobes use per
 * lib/wardrobe-paths.ts. Everything else is refused, including traversal and
 * any path belonging to a different wardrobe or user.
 */
function isPathWithinWardrobe(
    filePath: string,
    wardrobeId: string,
    ownerId: string | null
): boolean {
    if (!filePath || filePath.includes('..') || filePath.startsWith('/')) return false;

    const allowed = [`wardrobe/${wardrobeId}/`];
    if (ownerId) allowed.push(`${ownerId}/`);

    // A trailing segment is required: the prefix alone is a folder, not a file.
    return allowed.some((prefix) => filePath.startsWith(prefix) && filePath.length > prefix.length);
}

/**
 * Step 2: Create the wardrobe item record after client uploads directly to storage
 */
export async function createWardrobeItem(
    token: string,
    filePath: string,
    category: string,
    note: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

    // 1. Validate token (existence, active status and expiry)
    const resolved = await resolveWardrobeByToken(supabase, token);
    if (!resolved.ok) return { success: false, error: resolved.error };
    const wardrobe = resolved.wardrobe!;

    // 2. The path must be one this token could actually have been issued.
    //
    // Previously any `filePath` was accepted, so a holder of wardrobe A's
    // token could create an item in A pointing at an object under wardrobe B's
    // folder — or under another user's folder entirely. Whether that image
    // then rendered depended on storage policy rather than on this check,
    // which is the wrong place for the boundary to live (F10).
    if (!isPathWithinWardrobe(filePath, wardrobe.id, wardrobe.owner_id)) {
        console.error('[createWardrobeItem] Rejected out-of-scope path for wardrobe', wardrobe.id);
        return { success: false, error: "Invalid upload path" };
    }

    // 3. The cap applies to items, not only to upload URLs. Checking it only
    // when a URL was minted let one uploaded object be replayed through here
    // into any number of rows.
    if (await isWardrobeFull(supabase, wardrobe.id)) {
        return { success: false, error: "This wardrobe has reached its upload limit." };
    }

    try {
        // 4. The object must exist. Without this an item row can be created
        // pointing at nothing, which shows up later as a broken image with no
        // obvious cause.
        const folder = filePath.slice(0, filePath.lastIndexOf('/'));
        const name = filePath.slice(filePath.lastIndexOf('/') + 1);
        const { data: found, error: listError } = await supabase.storage
            .from('studio-wardrobe')
            .list(folder, { search: name, limit: 1 });

        if (listError) throw listError;
        if (!found?.some((f) => f.name === name)) {
            return { success: false, error: "Upload not found. Please try again." };
        }

        // 5. Get public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
            .from('studio-wardrobe')
            .getPublicUrl(filePath);

        // 6. Insert into database
        const { error: dbError } = await supabase
            .from('wardrobe_items')
            .insert({
                wardrobe_id: wardrobe.id,
                user_id: wardrobe.owner_id,
                image_url: publicUrl,
                client_note: note || "",
                category: category || null,
                status: 'inbox'
            });

        if (dbError) throw dbError;

        return { success: true };

    } catch (error) {
        console.error("Create Item Error:", error);
        return { success: false, error: getErrorMessage(error) || "Failed to save item" };
    }
}

// =============================================================================
// Regenerate Upload Token (invalidates old links)
// =============================================================================

export async function regenerateUploadToken(wardrobeId: string): Promise<{
    success: boolean;
    newToken?: string;
    error?: string;
}> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const supabase = auth.supabase;

    const newToken = crypto.randomUUID();

    const { error } = await supabase
        .from('wardrobes')
        .update({
            upload_token: newToken,
            // A rotated token starts its own week; carrying the old expiry
            // over would make rotation shorten the link's life.
            upload_token_expires_at: uploadTokenExpiry(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', wardrobeId);

    if (error) {
        console.error('Error regenerating token:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/studio');
    return { success: true, newToken };
}

// =============================================================================
// Get User's Own Wardrobe (for vault profile page)
// =============================================================================

export async function getMyWardrobe(): Promise<{
    success: boolean;
    wardrobe?: Wardrobe;
    error?: string;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // First check if user has a wardrobe
    let { data: wardrobe } = await supabase
        .from('wardrobes')
        .select('*')
        .eq('owner_id', user.id)
        .eq('status', 'active')
        .single();

    // First visit: create it. Only for a Studio client — this action is
    // callable by any signed-in member — and through the service role, because
    // RLS lets only the admin insert wardrobes. Through the member's own client
    // this always failed, and /vault/my-studio sent her back to /vault.
    if (!wardrobe) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('active_studio_client')
            .eq('id', user.id)
            .single();

        if (!profile?.active_studio_client) {
            return { success: false, error: "Studio access is required for a wardrobe." };
        }

        const { data: newWardrobe, error: createError } = await createAdminClient()
            .from('wardrobes')
            .insert({ owner_id: user.id, title: 'My Wardrobe' })
            .select()
            .single();

        if (createError) {
            console.error('Error creating wardrobe:', createError);
            return { success: false, error: createError.message };
        }

        wardrobe = newWardrobe;
    }

    return { success: true, wardrobe: wardrobe as Wardrobe };
}

// =============================================================================
// Admin: Assign Wardrobe to User
// =============================================================================

export async function assignWardrobe(
    wardrobeId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const adminSupabase = createAdminClient();

    // 1. Update Wardrobe Owner
    const { error: wardrobeError } = await adminSupabase
        .from('wardrobes')
        .update({ owner_id: userId, updated_at: new Date().toISOString() })
        .eq('id', wardrobeId);

    if (wardrobeError) {
        console.error('Error assigning wardrobe:', wardrobeError);
        return { success: false, error: wardrobeError.message };
    }

    // 2. Enable Studio Access for User
    const { error: profileError } = await adminSupabase
        .from('profiles')
        .update({ active_studio_client: true })
        .eq('id', userId);

    if (profileError) {
        console.error('Error updating profile status:', profileError);
    }

    // 3. Transfer Items (Fix for "Pieces don't show")
    // Ensure all items in this wardrobe belong to the new owner
    const { error: itemsError } = await adminSupabase
        .from('wardrobe_items')
        .update({ user_id: userId })
        .eq('wardrobe_id', wardrobeId);

    if (itemsError) {
        console.error('Error transferring items:', itemsError);
    }

    revalidatePath('/vault/studio');
    return { success: true };
}

// =============================================================================
// User: Claim Wardrobe (via Token)
// =============================================================================

export async function claimWardrobe(token: string): Promise<{ success: boolean; error?: string; wardrobeId?: string }> {
    const supabase = await createClient(); // Authenticated client for the claiming user

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "You must be logged in to claim a wardrobe." };

    const adminSupabase = createAdminClient();

    // 1. Find Wardrobe by Upload Token (MUST use admin client - RLS policy was dropped).
    //    `requireActive: false` because an archived wardrobe should still be
    //    claimable by the person it belongs to; expiry still applies.
    const resolvedClaim = await resolveWardrobeByToken(adminSupabase, token, { requireActive: false });
    if (!resolvedClaim.ok) {
        console.error('[claimWardrobe] Token lookup failed (value withheld)');
        return { success: false, error: resolvedClaim.error ?? "Invalid or expired claim token." };
    }
    const wardrobe = resolvedClaim.wardrobe!;

    // 2. Check if already owned
    if (wardrobe.owner_id && wardrobe.owner_id !== user.id) {
        return { success: false, error: "This wardrobe is already owned by another user." };
    }

    if (wardrobe.owner_id === user.id) {
        // Already owned by self - still ensure studio access is enabled
        await adminSupabase
            .from('profiles')
            .update({ active_studio_client: true })
            .eq('id', user.id);
        return { success: true, wardrobeId: wardrobe.id };
    }

    // 3. Claim it, atomically.
    //
    // The ownership check above and this write used to be two steps against a
    // row anyone with the token could reach, so two holders could both pass
    // the check and both write — last one wins, and the first claimant was
    // told they had succeeded. Adding `owner_id IS NULL` to the update makes
    // the database pick exactly one winner: the loser gets no row back.
    const { data: claimed, error: updateError } = await adminSupabase
        .from('wardrobes')
        .update({ owner_id: user.id, updated_at: new Date().toISOString() })
        .eq('id', wardrobe.id)
        .is('owner_id', null)
        .select('id')
        .maybeSingle();

    if (updateError) {
        console.error('[claimWardrobe] Update failed:', updateError.message);
        return { success: false, error: updateError.message };
    }

    if (!claimed) {
        // Someone claimed it between the read above and this write.
        return { success: false, error: "This wardrobe is already owned by another user." };
    }

    // 4. Enable Studio Access for the claiming user
    const { error: profileError } = await adminSupabase
        .from('profiles')
        .update({ active_studio_client: true })
        .eq('id', user.id);

    if (profileError) {
        console.error('[claimWardrobe] Profile update failed:', profileError.message);
        // Don't fail the whole operation, wardrobe was claimed successfully
    }

    console.log('[claimWardrobe] Success - User:', user.id, 'Wardrobe:', wardrobe.id);
    revalidatePath('/vault');
    return { success: true, wardrobeId: wardrobe.id };
}

// =============================================================================
// Admin: Permanently Delete Wardrobe
// =============================================================================

export async function deleteWardrobe(
    wardrobeId: string
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
        .from('wardrobes')
        .delete()
        .eq('id', wardrobeId);

    if (error) {
        console.error('Error deleting wardrobe:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/studio');
    return { success: true };
}

// =============================================================================
// Helper: Search Profiles (for assignment)
// =============================================================================

export async function searchProfiles(query: string): Promise<{ success: boolean; profiles?: { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[]; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const supabase = auth.supabase;

    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .ilike('full_name', `%${query}%`)
        .limit(10);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true, profiles: data };
}

// =============================================================================
// Admin: wardrobe items (service-role — see internal_note note below)
// =============================================================================

/**
 * Read a wardrobe's items for the admin (Studio) view, including the private
 * `internal_note`.
 *
 * This goes through the service role rather than the browser client because
 * column privileges are not role-aware beyond the Postgres role: Ale and her
 * clients are both `authenticated`, so revoking `internal_note` from that role
 * to hide it from clients hides it from Ale too. Admin reads therefore come
 * through a guarded server action, mirroring `getAdminBrands` for
 * `partner_brands.internal_notes`.
 */
export async function getAdminWardrobeItems(wardrobeId: string): Promise<{
    success: boolean;
    items?: WardrobeItem[];
    error?: string;
}> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsedId = parseInput(uuid('Wardrobe id'), wardrobeId);
    if (!parsedId.ok) return { success: false, error: parsedId.error };

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('wardrobe_id', parsedId.data)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };

    // Sign with the service-role client: the bucket is private and these paths
    // may sit under a client's folder.
    const items = await signWardrobeItems(supabase, (data ?? []) as WardrobeItem[]);
    return { success: true, items };
}

/** Admin edit of a single item, including the private note. */
export async function updateAdminWardrobeItem(
    itemId: string,
    updates: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsedId = parseInput(uuid('Item id'), itemId);
    if (!parsedId.ok) return { success: false, error: parsedId.error };

    const parsed = parseInput(adminWardrobeItemUpdateSchema, updates);
    if (!parsed.ok) return { success: false, error: parsed.error };

    if (Object.keys(parsed.data).length === 0) {
        return { success: false, error: 'Nothing to update' };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('wardrobe_items')
        .update(parsed.data)
        .eq('id', parsedId.data);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Apply one curation status to many items in a single round-trip. */
export async function bulkSetItemStatus(
    itemIds: string[],
    status: string
): Promise<{ success: boolean; updated?: number; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(bulkStatusSchema, { item_ids: itemIds, status });
    if (!parsed.ok) return { success: false, error: parsed.error };

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('wardrobe_items')
        .update({ status: parsed.data.status })
        .in('id', parsed.data.item_ids)
        .select('id');

    if (error) return { success: false, error: error.message };
    return { success: true, updated: data?.length ?? 0 };
}

// =============================================================================
// Admin: Clone an item into another wardrobe
// =============================================================================

/**
 * Copy one item into `targetWardrobeId`.
 *
 * Items belong to a wardrobe, so the destination is a wardrobe — not a profile.
 * The stored image is copied into the destination's own storage folder as well:
 * `can_access_wardrobe_object` is owner-or-admin, so a row pointing at the
 * source owner's path would render blank for the recipient.
 *
 * Notes are deliberately not carried over. `client_note` is the source client's
 * own writing and `notes` renders to the client as "Stylist Note", so copying
 * either would show one client another client's words. A clone duplicates the
 * garment, not the conversation about it.
 */
export async function cloneWardrobeItem(
    itemId: string,
    targetWardrobeId: string
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const supabase = createAdminClient();

    const { data: item, error: itemError } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('id', itemId)
        .single();

    if (itemError || !item) return { success: false, error: "Item not found" };

    const { data: target, error: targetError } = await supabase
        .from('wardrobes')
        .select('id, owner_id, title')
        .eq('id', targetWardrobeId)
        .eq('status', 'active')
        .single();

    if (targetError || !target) return { success: false, error: "Target wardrobe not found" };
    if (target.id === item.wardrobe_id) {
        return { success: false, error: "That item is already in this wardrobe" };
    }

    try {
        let imageUrl: string | null = item.image_url;

        const sourcePath = deriveStoragePath(item.image_url);
        if (sourcePath) {
            const fileName = sourcePath.split('/').pop() || 'item';
            const destPath = wardrobeUploadPath(target.owner_id, target.id, fileName);

            const { error: copyError } = await supabase.storage
                .from('studio-wardrobe')
                .copy(sourcePath, destPath);
            if (copyError) throw copyError;

            const { data: { publicUrl } } = supabase.storage
                .from('studio-wardrobe')
                .getPublicUrl(destPath);
            imageUrl = publicUrl;
        }

        const { error: insertError } = await supabase
            .from('wardrobe_items')
            .insert({
                wardrobe_id: target.id,
                user_id: target.owner_id,
                image_url: imageUrl,
                category: item.category,
                brand: item.brand,
                status: item.status,
                tags: item.tags,
                product_link_id: item.product_link_id,
                is_general_library: item.is_general_library,
            });
        if (insertError) throw insertError;

        revalidatePath('/vault/studio');
        return { success: true };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}
