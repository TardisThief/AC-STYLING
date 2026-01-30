
'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// --- Brands ---

export async function createBrand(data: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('partner_brands').insert({
        name: data.name,
        logo_url: data.logo_url,
        website_url: data.website_url,
        active: data.active !== false
    });

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function updateBrand(id: string, data: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('partner_brands').update({
        name: data.name,
        logo_url: data.logo_url,
        website_url: data.website_url,
        active: data.active
    }).eq('id', id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function deleteBrand(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('partner_brands').delete().eq('id', id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

// --- Items ---

export async function createBoutiqueItem(data: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('boutique_items').insert({
        name: data.name,
        brand_id: data.brand_id || null, // Handle empty string
        image_url: data.image_url,
        curator_note: data.curator_note,
        affiliate_url_usa: data.affiliate_url_usa,
        affiliate_url_es: data.affiliate_url_es,
        category: data.category,
        active: data.active !== false
    });

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function updateBoutiqueItem(id: string, data: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('boutique_items').update({
        name: data.name,
        brand_id: data.brand_id || null, // Handle empty string
        image_url: data.image_url,
        curator_note: data.curator_note,
        affiliate_url_usa: data.affiliate_url_usa,
        affiliate_url_es: data.affiliate_url_es,
        category: data.category,
        active: data.active
    }).eq('id', id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function deleteBoutiqueItem(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('boutique_items').delete().eq('id', id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}
