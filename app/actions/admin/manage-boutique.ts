
'use server';

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/app/lib/auth-guards";
import { parseInput, uuid } from "@/app/lib/validation/parse";
import {
    brandSchema,
    boutiqueItemSchema,
    collectionSchema,
    trustedByLogoSchema,
    trustedByLogoUpdateSchema,
} from "@/app/lib/validation/boutique";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// --- Brands ---

/**
 * Fetch full partner_brand rows (including internal_notes / commission_rate /
 * contact_email) for the admin editor. Uses the service-role client so it can
 * read the sensitive columns that are column-revoked from anon/authenticated;
 * gated by requireAdmin so only admins reach it.
 */
export async function getAdminBrands() {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const supabase = createAdminClient();
    const { data: brands, error } = await supabase
        .from('partner_brands')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) {
        console.error("Fetch Admin Brands Error:", error);
        return { success: false, error: error.message };
    }

    return { success: true, brands };
}

export async function createBrand(data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(brandSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase.from('partner_brands').insert(parsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function updateBrand(id: string, data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Brand id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(brandSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('partner_brands')
        .update(parsed.data)
        .eq('id', idParsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function deleteBrand(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Brand id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase.from('partner_brands').delete().eq('id', idParsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

// --- Items ---

export async function createBoutiqueItem(data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(boutiqueItemSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase.from('boutique_items').insert(parsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function updateBoutiqueItem(id: string, data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Item id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(boutiqueItemSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('boutique_items')
        .update(parsed.data)
        .eq('id', idParsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function deleteBoutiqueItem(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Item id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase.from('boutique_items').delete().eq('id', idParsed.data);

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

export async function createCollection(data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(collectionSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { data: created, error } = await auth.supabase
        .from('boutique_collections')
        .insert(parsed.data)
        .select('id')
        .single();

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true, id: created.id };
}

export async function updateCollection(id: string, data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Collection id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(collectionSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('boutique_collections')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', idParsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function deleteCollection(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Collection id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase
        .from('boutique_collections')
        .delete()
        .eq('id', idParsed.data);
    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function setCollectionItems(collectionId: string, itemIds: string[]) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Collection id'), collectionId);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const itemsParsed = parseInput(z.array(uuid('Item id')), itemIds);
    if (!itemsParsed.ok) return { success: false, error: itemsParsed.error };

    // Replace all items for this collection
    await auth.supabase.from('boutique_collection_items').delete().eq('collection_id', idParsed.data);

    if (itemsParsed.data.length > 0) {
        const rows = itemsParsed.data.map((item_id, idx) => ({
            collection_id: idParsed.data,
            item_id,
            position: idx,
        }));
        const { error } = await auth.supabase.from('boutique_collection_items').insert(rows);
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
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(trustedByLogoSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase.from('trusted_by_logos').insert({
        ...parsed.data,
        active: true,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath('/');
    return { success: true };
}

export async function updateTrustedByLogo(id: string, data: Partial<{ name: string; logo_url: string; order_index: number; active: boolean }>) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Logo id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(trustedByLogoUpdateSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('trusted_by_logos')
        .update(parsed.data)
        .eq('id', idParsed.data);
    if (error) return { success: false, error: error.message };
    revalidatePath('/');
    return { success: true };
}

export async function deleteTrustedByLogo(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Logo id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase.from('trusted_by_logos').delete().eq('id', idParsed.data);
    if (error) return { success: false, error: error.message };
    revalidatePath('/');
    return { success: true };
}
