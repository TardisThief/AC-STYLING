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

    const { error } = await supabase
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
// Upload Item to Wardrobe (via token - for guests)
// =============================================================================

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

    // 1. Update Wardrobe Owner
    const { error: wardrobeError } = await supabase
        .from('wardrobes')
        .update({ owner_id: userId, updated_at: new Date().toISOString() })
        .eq('id', wardrobeId);

    if (wardrobeError) {
        console.error('Error assigning wardrobe:', wardrobeError);
        return { success: false, error: wardrobeError.message };
    }

    // 2. Enable Studio Access for User
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ active_studio_client: true })
        .eq('id', userId);

    if (profileError) {
        console.error('Error updating profile status:', profileError);
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

    // 1. Find Wardrobe by Upload Token (using Admin client to bypass RLS for lookup if needed, 
    //    though "Upload token access" policy should allow SELECT via anon/authenticated)
    //    Actually, RLS policy "Upload token access" allows SELECT if upload_token IS NOT NULL.
    //    So we can use the regular client.

    const { data: wardrobe, error: findError } = await supabase
        .from('wardrobes')
        .select('id, owner_id')
        .eq('upload_token', token)
        .single();

    if (findError || !wardrobe) {
        return { success: false, error: "Invalid or expired claim token." };
    }

    // 2. Check if already owned
    if (wardrobe.owner_id && wardrobe.owner_id !== user.id) {
        return { success: false, error: "This wardrobe is already owned by another user." };
    }

    if (wardrobe.owner_id === user.id) {
        return { success: true, wardrobeId: wardrobe.id }; // Already owned by self, assume success
    }

    // 3. Claim it (Update Owner)
    const { error: updateError } = await supabase
        .from('wardrobes')
        .update({ owner_id: user.id, updated_at: new Date().toISOString() })
        .eq('id', wardrobe.id);

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    // 4. Enable Studio Access for the claiming user
    await supabase
        .from('profiles')
        .update({ active_studio_client: true })
        .eq('id', user.id);

    revalidatePath('/vault');
    return { success: true, wardrobeId: wardrobe.id };
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
