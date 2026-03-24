"use server";

// ... extractUrlMetadata MOVED to scraper.ts ...

// ... updateProfileStatus remains unchanged ...

export async function updateProfileStatus(profileId: string, status: 'active' | 'archived') {
    const { createClient } = await import("@/utils/supabase/server");
    const { revalidatePath } = await import("next/cache");
    const supabase = await createClient();

    // 1. Check if Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ status })
            .eq('id', profileId);

        if (error) throw error;

        revalidatePath('/[locale]/vault/studio', 'page');
        return { success: true };
    } catch (err: any) {
        console.error("Update Status Error:", err);
        return { success: false, error: err.message };
    }
}

// ... permanentDeleteProfile remains unchanged ...
export async function permanentDeleteProfile(profileId: string) {
    const { createClient } = await import("@/utils/supabase/server");
    const { revalidatePath } = await import("next/cache");
    const supabase = await createClient();

    // 1. Check if Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        // FKs are ON DELETE CASCADE in studio_schema, so this should wipe assets/lookbooks too
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', profileId);

        if (error) throw error;

        revalidatePath('/[locale]/vault/studio', 'page');
        return { success: true };
    } catch (err: any) {
        console.error("Delete Profile Error:", err);
        return { success: false, error: err.message };
    }
}

// ... deleteWardrobeItem remains unchanged ...
export async function deleteWardrobeItem(itemId: string) {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // 2. Get Item to check ownership & image path
    const { data: item, error: fetchError } = await supabase
        .from('wardrobe_items')
        .select('user_id, image_url')
        .eq('id', itemId)
        .single();

    if (fetchError || !item) return { success: false, error: "Item not found" };

    // 3. Permission Check
    // Allow if Owner OR Admin
    let canDelete = item.user_id === user.id;

    if (!canDelete) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role === 'admin') canDelete = true;
    }

    if (!canDelete) return { success: false, error: "Unauthorized" };

    try {
        // 4. Delete Database Record
        const { error: deleteError } = await supabase
            .from('wardrobe_items')
            .delete()
            .eq('id', itemId);

        if (deleteError) throw deleteError;

        // 5. Delete from Storage (Best Effort)
        // Extract path from public URL: .../studio-wardrobe/user_id/filename
        try {
            const url = new URL(item.image_url);
            const pathParts = url.pathname.split('/studio-wardrobe/');
            if (pathParts.length > 1) {
                const storagePath = pathParts[1]; // Should comprise "userId/filename" or similar
                // We decodeURI just in case spaces etc
                await supabase.storage.from('studio-wardrobe').remove([decodeURIComponent(storagePath)]);
            }
        } catch (storageErr) {
            console.warn("Failed to delete storage file (orphaned):", storageErr);
        }

        return { success: true };
    } catch (err: any) {
        console.error("Delete Item Error:", err);
        return { success: false, error: err.message };
    }
}

// --- NEW ACTIONS FOR STUDIO INBOX ---

export async function getStudioInboxItems() {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();

    // 1. Auth Check (Admin Only)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: "Unauthorized" };

    // 2. Fetch Inbox Items
    // Use select with join to get profile full_name
    const { data, error } = await supabase
        .from('wardrobe_items')
        .select(`
            *,
            profiles:user_id ( full_name )
        `)
        .eq('status', 'inbox') // TODO: Ensure you migrate existing items or handle NULL
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error("Fetch Inbox Error:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data };
}

export async function processWardrobeItem(
    itemId: string,
    status: 'keep' | 'donate' | 'repair' | 'inbox',
    metadata?: { tags?: string[], brand?: string, notes?: string }
) {
    const { createClient } = await import("@/utils/supabase/server");
    const { revalidatePath } = await import("next/cache");
    const supabase = await createClient();

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: "Unauthorized" };

    // 2. Validate Payload
    const updates: any = { status };
    if (metadata?.tags) {
        if (!Array.isArray(metadata.tags) || metadata.tags.length > 50) return { success: false, error: "Invalid tags format or too many tags" };
        updates.tags = metadata.tags.map(t => String(t).substring(0, 50));
    }
    if (metadata?.brand) {
        updates.brand = String(metadata.brand).substring(0, 100);
    }
    if (metadata?.notes) {
        updates.notes = String(metadata.notes).substring(0, 1000);
    }

    const { error } = await supabase
        .from('wardrobe_items')
        .update(updates)
        .eq('id', itemId);

    if (error) {
        console.error("Update Item Error:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/admin', 'page');
    return { success: true };
}

export async function uploadRemoteImage(imageUrl: string, userId: string) {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        // 2. Fetch the remote image
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Determine extension
        const ext = contentType.split('/')[1] || 'jpg';
        const fileName = `${Date.now()}-remote.${ext}`;
        const filePath = `${userId}/${fileName}`;

        // 3. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('studio-wardrobe')
            .upload(filePath, buffer, {
                contentType,
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 4. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('studio-wardrobe')
            .getPublicUrl(filePath);

        return { success: true, url: publicUrl };

    } catch (error: any) {
        console.error("Remote Upload Error:", error);
        return { success: false, error: error.message || "Failed to upload remote image" };
    }
}

export async function uploadGuestWardrobeItem(formData: FormData, token: string) {
    // USE SERVICE ROLE TO BYPASS RLS FOR GUEST UPLOADS
    // Guests are "anon" so they can't insert into wardrobe_items for another user (even if it's an invite profile)
    // We validate the token (Business Logic) -> Then use Admin Privileges (Service Role) to execute.
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Validate Token & Find Invite Profile
    const { data: inviteProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('intake_token', token)
        .single();

    if (profileError || !inviteProfile) {
        return { success: false, error: "Invalid or expired intake token." };
    }

    try {
        const file = formData.get('file') as File;
        const clientNote = formData.get('note') as string;

        if (!file) throw new Error("No file provided");

        // VALIDATION: File type and size
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error(`Invalid file type: ${file.type}. Only JPG, PNG, WEBP, and HEIC are allowed.`);
        }

        const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
        if (file.size > MAX_SIZE) {
            throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed size is 20MB.`);
        }

        // 2. Upload to Storage (Using Invite Profile ID)
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${inviteProfile.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `wardrobe/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('studio-wardrobe')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('studio-wardrobe')
            .getPublicUrl(filePath);

        // 4. Insert into Database (Linked to Invite Profile)
        const { error: dbError } = await supabase
            .from('wardrobe_items')
            .insert({
                user_id: inviteProfile.id,
                image_url: publicUrl,
                client_note: clientNote || "",
                status: 'inbox' // Mark as inbox for admin review
            });

        if (dbError) throw dbError;

        return { success: true };

    } catch (error: any) {
        console.error("Guest Upload Error:", error);
        return { success: false, error: error.message || "Upload failed" };
    }
}

// =============================================================================
// ACTIVATE STUDIO ACCESS (Authenticated Flow)
// =============================================================================

export async function activateStudioAccess(token: string) {
    const { createClient } = await import("@/utils/supabase/server");
    const { createAdminClient } = await import("@/utils/supabase/admin"); // Admin needed for profile lookup/transfer
    const supabase = await createClient();

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const adminSupabase = createAdminClient();

    // 2. Validate Token (Find the Guest Profile associated with this invite)
    const { data: inviteProfile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('*')
        .eq('intake_token', token)
        .single();

    if (profileError || !inviteProfile) {
        // Fallback: Check if this user ALREADY successfully claimed it?
        const { data: currentUser } = await adminSupabase.from('profiles').select('intake_token, active_studio_client').eq('id', user.id).single();
        if (currentUser?.intake_token === token && currentUser?.active_studio_client) {
            return { success: true };
        }
        return { success: false, error: "Invalid or expired intake link." };
    }

    // Prevent self-clobbering 
    if (inviteProfile.id === user.id) {
        await adminSupabase.from('profiles').update({ active_studio_client: true }).eq('id', user.id);
        return { success: true };
    }

    // 3. Grant Access to Current User
    const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({
            active_studio_client: true, // UNLOCK STUDIO
            studio_permissions: inviteProfile.studio_permissions || { lookbook: true, wardrobe: true },
            intake_token: token // Link token to real user for record
        })
        .eq('id', user.id);

    if (updateError) {
        console.error("Activate Studio Error:", updateError);
        return { success: false, error: "Failed to activate studio access." };
    }

    // 4. Ensure Wardrobe Exists
    const { data: existingWardrobe } = await adminSupabase
        .from('wardrobes')
        .select('id')
        .eq('owner_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

    let wardrobeId = existingWardrobe?.id;

    if (!wardrobeId) {
        // Create it
        const { data: newWardrobe } = await adminSupabase
            .from('wardrobes')
            .insert({
                owner_id: user.id,
                title: 'My Wardrobe',
                status: 'active'
            })
            .select('id')
            .single();
        wardrobeId = newWardrobe?.id;
    }

    // 5. Cleanup Invite Profile & Transfer any legacy items (Safety Net)
    if (inviteProfile.id !== user.id) {
        if (wardrobeId) {
            await adminSupabase.from('wardrobe_items').update({ user_id: user.id, wardrobe_id: wardrobeId }).eq('user_id', inviteProfile.id);
        }
        await adminSupabase.from('tailor_cards').update({ user_id: user.id }).eq('user_id', inviteProfile.id);
        await adminSupabase.from('lookbooks').update({ user_id: user.id }).eq('user_id', inviteProfile.id);
        await adminSupabase.from('profiles').delete().eq('id', inviteProfile.id);
    }

    return { success: true };
}
