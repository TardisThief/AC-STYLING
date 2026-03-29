
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
        active: data.active !== false,
        contact_name: data.contact_name || null,
        contact_email: data.contact_email || null,
        commission_rate: data.commission_rate ? parseFloat(data.commission_rate) : null,
        partnership_status: data.partnership_status || 'active',
        internal_notes: data.internal_notes || null,
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
        active: data.active,
        contact_name: data.contact_name || null,
        contact_email: data.contact_email || null,
        commission_rate: data.commission_rate ? parseFloat(data.commission_rate) : null,
        partnership_status: data.partnership_status || 'active',
        internal_notes: data.internal_notes || null,
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

// --- Collections ---

export async function getCollections() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('boutique_collections')
        .select('*, items:boutique_collection_items(item_id)')
        .order('order_index', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, collections: data || [] };
}

export async function createCollection(data: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: created, error } = await supabase.from('boutique_collections').insert({
        title: data.title,
        title_es: data.title_es || null,
        description: data.description || null,
        description_es: data.description_es || null,
        cover_image_url: data.cover_image_url || null,
        active: data.active !== false,
        order_index: data.order_index || 0,
    }).select('id').single();

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true, id: created.id };
}

export async function updateCollection(id: string, data: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('boutique_collections').update({
        title: data.title,
        title_es: data.title_es || null,
        description: data.description || null,
        description_es: data.description_es || null,
        cover_image_url: data.cover_image_url || null,
        active: data.active,
        order_index: data.order_index,
        updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function deleteCollection(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('boutique_collections').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function setCollectionItems(collectionId: string, itemIds: string[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // Replace all items for this collection
    await supabase.from('boutique_collection_items').delete().eq('collection_id', collectionId);

    if (itemIds.length > 0) {
        const rows = itemIds.map((item_id, idx) => ({ collection_id: collectionId, item_id, position: idx }));
        const { error } = await supabase.from('boutique_collection_items').insert(rows);
        if (error) return { success: false, error: error.message };
    }

    revalidatePath('/vault/boutique');
    return { success: true };
}

// --- Trusted By ---

export async function getTrustedByLogos() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('trusted_by_logos')
        .select('*')
        .order('order_index', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, logos: data || [] };
}

export async function createTrustedByLogo(data: { name: string; logo_url: string; order_index?: number }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('trusted_by_logos').insert({
        name: data.name,
        logo_url: data.logo_url,
        order_index: data.order_index || 0,
        active: true,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath('/');
    return { success: true };
}

export async function updateTrustedByLogo(id: string, data: Partial<{ name: string; logo_url: string; order_index: number; active: boolean }>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('trusted_by_logos').update(data).eq('id', id);
    if (error) return { success: false, error: error.message };
    revalidatePath('/');
    return { success: true };
}

export async function deleteTrustedByLogo(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('trusted_by_logos').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    revalidatePath('/');
    return { success: true };
}
