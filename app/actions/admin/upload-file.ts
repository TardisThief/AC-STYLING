"use server";

import { createClient } from '@/utils/supabase/server';

export async function uploadFile(formData: FormData) {
    const supabase = await createClient();

    // Check admin role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    const file = formData.get('file') as File;
    if (!file) {
        return { success: false, error: "No file provided" };
    }

    // Upload to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
        .from('vault-assets')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error("Upload error:", error);
        return { success: false, error: error.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('vault-assets')
        .getPublicUrl(data.path);

    return { success: true, url: publicUrl, path: data.path };
}
