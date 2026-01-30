'use server'

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function getOffer(slug: string) {
    const supabase = await createClient();
    const { data: offer, error } = await supabase
        .from('offers')
        .select('*')
        .eq('slug', slug)
        .single();

    // It's okay if not found initially
    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching offer:", error);
        return { success: false, error: 'Failed to fetch offer' };
    }

    return { success: true, offer };
}

export async function upsertOffer(offerData: any) {
    const supabase = await createClient();

    // Admin Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') return { success: false, error: 'Forbidden' };

    // Force slug if new
    if (!offerData.slug && !offerData.id) {
        return { success: false, error: "Slug is required" };
    }

    const { error } = await supabase
        .from('offers')
        .upsert(offerData)
        .select()
        .single();

    if (error) {
        console.error("Error saving offer:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/foundations', 'page'); // Revalidate potential consumer
    return { success: true };
}
