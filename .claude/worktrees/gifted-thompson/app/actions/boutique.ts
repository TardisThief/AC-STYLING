
'use server';

import { createClient } from "@/utils/supabase/server";

export type PartnerBrand = {
    id: string;
    name: string;
    logo_url: string | null;
    website_url: string | null;
};

export type BoutiqueItem = {
    id: string;
    name: string;
    brand_id: string;
    image_url: string;
    curator_note: string | null;
    affiliate_url_usa: string | null;
    affiliate_url_es: string | null;
    brand?: {
        name: string;
    };
};

/**
 * Fetch all active partner brands for the Atelier bar.
 */
export async function getActiveBrands() {
    const supabase = await createClient();

    // Check user for RLS (implicitly handled by supabase client but good form)
    // Actually public read so no user check needed for display.

    const { data: brands, error } = await supabase
        .from('partner_brands')
        .select('*')
        .eq('active', true)
        .order('order_index', { ascending: true });

    if (error) {
        console.error("Fetch Brands Error:", error);
        return { success: false, error: error.message };
    }

    return { success: true, brands };
}

/**
 * Fetch all active boutique items, optionally filtered by brand.
 */
export async function getBoutiqueItems(brandId?: string) {
    const supabase = await createClient();

    let query = supabase
        .from('boutique_items')
        .select(`
            *,
            brand:partner_brands(name)
        `)
        .eq('active', true)
        .order('order_index', { ascending: true });

    if (brandId) {
        query = query.eq('brand_id', brandId);
    }

    const { data: items, error } = await query;

    if (error) {
        console.error("Fetch Items Error:", error);
        return { success: false, error: error.message };
    }

    return { success: true, items };
}
