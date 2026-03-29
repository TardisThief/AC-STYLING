"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// =============================================================================
// Boutique Bulk Upload Actions
// =============================================================================

/**
 * Step 1: Get a signed URL for direct browser → Supabase Storage upload
 * This allows uploading large files without hitting Vercel serverless limits.
 */
export async function getSignedBoutiqueUploadUrl(
    fileName: string,
    fileType: string
): Promise<{ success: boolean; signedUrl?: string; filePath?: string; publicUrl?: string; error?: string }> {
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

    try {
        // 1. Generate unique file path
        const fileExt = fileName.split('.').pop() || 'jpg';
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `items/${uniqueName}`; // Store in 'boutique' bucket under 'items' folder

        // 2. Create signed upload URL (valid for 5 minutes)
        const { data, error: signError } = await supabase.storage
            .from('boutique')
            .createSignedUploadUrl(filePath);

        if (signError || !data) {
            throw signError || new Error("Failed to create upload URL");
        }

        // 3. Get the public URL anticipating success (so we can preview/save it immediately)
        const { data: { publicUrl } } = supabase.storage
            .from('boutique')
            .getPublicUrl(filePath);

        return {
            success: true,
            signedUrl: data.signedUrl,
            filePath: filePath,
            publicUrl: publicUrl
        };

    } catch (error: any) {
        console.error("Signed URL Error:", error);
        return { success: false, error: error.message || "Failed to prepare upload" };
    }
}

export type BoutiqueItemPayload = {
    brand_id: string;
    name: string;
    image_url: string;
    category: string;
    curator_note?: string;
    affiliate_url_usa?: string;
    affiliate_url_es?: string;
    active: boolean;
};

/**
 * Step 2: Batch create items in the database
 */
export async function createBoutiqueItemsBatch(
    items: BoutiqueItemPayload[]
): Promise<{ success: boolean; error?: string; count?: number }> {
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

    try {
        const { error, count } = await supabase
            .from('boutique_items')
            .insert(items)
            .select('id');

        if (error) throw error;

        revalidatePath('/vault/boutique');
        revalidatePath('/vault/admin');

        return { success: true, count: count || items.length };

    } catch (error: any) {
        console.error("Batch Create Error:", error);
        return { success: false, error: error.message || "Failed to create items" };
    }
}
