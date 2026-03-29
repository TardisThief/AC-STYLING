"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

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
    const supabase = await createClient();

    // Check admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

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
        const supabase = await createClient();

        // Check admin
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return { success: false, error: "Unauthorized" };
        }

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
    } catch (error: any) {
        console.error("Critical Error in createWardrobe:", error);
        return { success: false, error: error.message || "Internal Server Error" };
    }
}

// =============================================================================
// Admin: Update Wardrobe
// =============================================================================

export async function updateWardrobe(
    wardrobeId: string,
    updates: { title?: string; owner_id?: string | null; status?: 'active' | 'archived' }
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Check admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
        .from('wardrobes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', wardrobeId);

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

    const { data, error } = await supabase
        .from('wardrobes')
        .select('*')
        .eq('upload_token', token)
        .eq('status', 'active')
        .single();

    if (error || !data) {
        return { success: false, error: "Invalid or expired upload link" };
    }

    return { success: true, wardrobe: data as Wardrobe };
}

// =============================================================================
// Direct Upload Flow (bypasses Vercel serverless limits)
// =============================================================================

/**
 * Step 1: Get a signed URL for direct browser → Supabase Storage upload
 * This validates the token and returns a URL the client can upload to directly
 */
export async function getSignedUploadUrl(
    token: string,
    fileName: string
): Promise<{ success: boolean; signedUrl?: string; filePath?: string; error?: string }> {
    const supabase = createAdminClient();

    // 1. Validate token
    const { data: wardrobe, error: wError } = await supabase
        .from('wardrobes')
        .select('id, owner_id')
        .eq('upload_token', token)
        .eq('status', 'active')
        .single();

    if (wError || !wardrobe) {
        return { success: false, error: "Invalid or expired upload link" };
    }

    try {
        // 2. Generate unique file path
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

    } catch (error: any) {
        console.error("Signed URL Error:", error);
        return { success: false, error: error.message || "Failed to prepare upload" };
    }
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

    // 1. Validate token
    const { data: wardrobe, error: wError } = await supabase
        .from('wardrobes')
        .select('id, owner_id')
        .eq('upload_token', token)
        .eq('status', 'active')
        .single();

    if (wError || !wardrobe) {
        return { success: false, error: "Invalid or expired upload link" };
    }

    try {
        // 2. Get public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
            .from('studio-wardrobe')
            .getPublicUrl(filePath);

        // 3. Insert into database
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

    } catch (error: any) {
        console.error("Create Item Error:", error);
        return { success: false, error: error.message || "Failed to save item" };
    }
}

// Legacy function - kept for backward compatibility but now uses direct upload internally
export async function uploadToWardrobe(
    formData: FormData,
    token: string
): Promise<{ success: boolean; error?: string }> {
    // Use service role for guest uploads
    const supabase = createAdminClient();

    // 1. Validate token
    const { data: wardrobe, error: wError } = await supabase
        .from('wardrobes')
        .select('id, owner_id')
        .eq('upload_token', token)
        .eq('status', 'active')
        .single();

    if (wError || !wardrobe) {
        return { success: false, error: "Invalid or expired upload link" };
    }

    try {
        const file = formData.get('file') as File;
        const clientNote = formData.get('note') as string;
        const category = formData.get('category') as string;

        if (!file) throw new Error("No file provided");

        // 2. Upload to storage
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${wardrobe.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `wardrobe/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('studio-wardrobe')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 3. Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('studio-wardrobe')
            .getPublicUrl(filePath);

        // 4. Insert into database (linked to wardrobe)
        const { error: dbError } = await supabase
            .from('wardrobe_items')
            .insert({
                wardrobe_id: wardrobe.id,
                user_id: wardrobe.owner_id, // Keep for backward compat
                image_url: publicUrl,
                client_note: clientNote || "",
                category: category || null,
                status: 'inbox'
            });

        if (dbError) throw dbError;

        return { success: true };

    } catch (error: any) {
        console.error("Wardrobe Upload Error:", error);
        return { success: false, error: error.message || "Upload failed" };
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
    const supabase = await createClient();

    // Check admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    const newToken = crypto.randomUUID();

    const { error } = await supabase
        .from('wardrobes')
        .update({ upload_token: newToken, updated_at: new Date().toISOString() })
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
    let { data: wardrobe, error } = await supabase
        .from('wardrobes')
        .select('*')
        .eq('owner_id', user.id)
        .eq('status', 'active')
        .single();

    // If no wardrobe exists, create one
    if (!wardrobe) {
        const { data: newWardrobe, error: createError } = await supabase
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
    const supabase = await createClient();

    // Check admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

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

    // 1. Find Wardrobe by Upload Token (MUST use admin client - RLS policy was dropped)
    const { data: wardrobe, error: findError } = await adminSupabase
        .from('wardrobes')
        .select('id, owner_id')
        .eq('upload_token', token)
        .single();

    if (findError || !wardrobe) {
        console.error('[claimWardrobe] Token lookup failed:', findError?.message || 'No wardrobe found');
        return { success: false, error: "Invalid or expired claim token." };
    }

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

    // 3. Claim it (Update Owner)
    const { error: updateError } = await adminSupabase
        .from('wardrobes')
        .update({ owner_id: user.id, updated_at: new Date().toISOString() })
        .eq('id', wardrobe.id);

    if (updateError) {
        console.error('[claimWardrobe] Update failed:', updateError.message);
        return { success: false, error: updateError.message };
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
    const supabase = await createClient();

    // Check admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

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

export async function searchProfiles(query: string): Promise<{ success: boolean; profiles?: any[]; error?: string }> {
    const supabase = await createClient();

    // Check admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (adminProfile?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

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
