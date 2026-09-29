"use server";

import { requireAdmin } from "@/app/lib/auth-guards";
import { parseInput, uuid } from "@/app/lib/validation/parse";
import {
    createLookbookSchema,
    lookbookStatusSchema,
    saveLookbookSchema,
} from "@/app/lib/validation/lookbooks";
import { canvasToStore, readCanvas } from "@/app/lib/lookbook-canvas";
import { isPathWithinWardrobe, wardrobeUploadPath } from "@/lib/wardrobe-paths";
import type { Lookbook } from "@/app/lib/types";

/**
 * Lookbook writes, for the stylist (DigitalLookbook's admin view).
 *
 * These were browser writes that relied on RLS alone: no validation, and the
 * whole row as the client held it went back to the database (2026-09-29,
 * ARCH-001). Each is now admin-guarded, validated with zod, and writes only
 * the parsed fields through the service role. A lookbook belongs to its
 * wardrobe (migration 36); its canvas holds placements of that wardrobe's
 * garments and nothing else (migration 35).
 */

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

const BUCKET = 'studio-wardrobe';

async function admin() {
    const { createAdminClient } = await import('@/utils/supabase/admin');
    return createAdminClient();
}

export async function createLookbook(input: unknown): Promise<Result<Lookbook>> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = parseInput(createLookbookSchema, input);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const db = await admin();
    const { data: wardrobe } = await db.from('wardrobes').select('id').eq('id', parsed.data.wardrobe_id).maybeSingle();
    if (!wardrobe) return { success: false, error: 'Wardrobe not found' };

    const { data, error } = await db
        .from('lookbooks')
        // lookbook_items takes the column default: an empty canvas.
        .insert({ ...parsed.data, status: 'Draft' })
        .select('*')
        .single();
    if (error || !data) return { success: false, error: error?.message ?? 'Could not create the lookbook' };
    return { success: true, data };
}

/**
 * Store the canvas, and the thumbnail when a new one was uploaded. Only
 * placements of garments in this lookbook's own wardrobe are kept, whatever
 * the caller sends.
 */
export async function saveLookbook(input: unknown): Promise<Result<Lookbook>> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = parseInput(saveLookbookSchema, input);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const db = await admin();
    const { data: lookbook } = await db.from('lookbooks').select('id, wardrobe_id').eq('id', parsed.data.id).maybeSingle();
    if (!lookbook) return { success: false, error: 'Lookbook not found' };

    const [{ data: items }, { data: wardrobe }] = await Promise.all([
        db.from('wardrobe_items').select('id').eq('wardrobe_id', lookbook.wardrobe_id),
        db.from('wardrobes').select('owner_id').eq('id', lookbook.wardrobe_id).maybeSingle(),
    ]);
    const placements = canvasToStore(readCanvas(parsed.data.lookbook_items), new Set((items ?? []).map((i) => i.id)));

    const patch: { lookbook_items: typeof placements; updated_at: string; thumbnail_url?: string } = {
        lookbook_items: placements,
        updated_at: new Date().toISOString(),
    };
    if (parsed.data.thumbnail_path) {
        if (!isPathWithinWardrobe(parsed.data.thumbnail_path, lookbook.wardrobe_id, wardrobe?.owner_id ?? null)) {
            return { success: false, error: 'Invalid thumbnail path' };
        }
        patch.thumbnail_url = db.storage.from(BUCKET).getPublicUrl(parsed.data.thumbnail_path).data.publicUrl;
    }

    const { data, error } = await db.from('lookbooks').update(patch).eq('id', lookbook.id).select('*').single();
    if (error || !data) return { success: false, error: error?.message ?? 'Could not save the lookbook' };
    return { success: true, data };
}

export async function setLookbookStatus(input: unknown): Promise<Result> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = parseInput(lookbookStatusSchema, input);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { data, error } = await (await admin())
        .from('lookbooks').update({ status: parsed.data.status }).eq('id', parsed.data.id).select('id');
    if (error || !data?.length) return { success: false, error: error?.message ?? 'Lookbook not found' };
    return { success: true };
}

export async function deleteLookbook(lookbookId: unknown): Promise<Result> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = parseInput(uuid('Lookbook'), lookbookId);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { data, error } = await (await admin()).from('lookbooks').delete().eq('id', parsed.data).select('id');
    if (error || !data?.length) return { success: false, error: error?.message ?? 'Lookbook not found' };
    return { success: true };
}

/** A draft copy in the same wardrobe: its canvas and title, never its id or dates. */
export async function cloneLookbook(lookbookId: unknown): Promise<Result<Lookbook>> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = parseInput(uuid('Lookbook'), lookbookId);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const db = await admin();
    const { data: source } = await db.from('lookbooks').select('*').eq('id', parsed.data).maybeSingle();
    if (!source) return { success: false, error: 'Lookbook not found' };

    const { data, error } = await db
        .from('lookbooks')
        .insert({
            wardrobe_id: source.wardrobe_id,
            title: `${source.title} (Copy)`,
            collection_name: source.collection_name,
            metadata: source.metadata,
            lookbook_items: source.lookbook_items,
            thumbnail_url: source.thumbnail_url,
            status: 'Draft',
        })
        .select('*')
        .single();
    if (error || !data) return { success: false, error: error?.message ?? 'Could not copy the lookbook' };
    return { success: true, data };
}

/**
 * Where the browser uploads a new thumbnail: a signed URL in the lookbook's
 * wardrobe folder. The bytes go straight to storage, never through an action.
 */
export async function getLookbookThumbnailUploadUrl(
    lookbookId: unknown
): Promise<{ success: true; path: string; token: string } | { success: false; error: string }> {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = parseInput(uuid('Lookbook'), lookbookId);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const db = await admin();
    const { data: lookbook } = await db.from('lookbooks').select('id, wardrobe_id').eq('id', parsed.data).maybeSingle();
    if (!lookbook) return { success: false, error: 'Lookbook not found' };
    const { data: wardrobe } = await db.from('wardrobes').select('owner_id').eq('id', lookbook.wardrobe_id).maybeSingle();

    const path = wardrobeUploadPath(wardrobe?.owner_id ?? null, lookbook.wardrobe_id, `lookbook-thumb-${lookbook.id}.jpg`);
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error || !data) return { success: false, error: error?.message ?? 'Could not prepare the upload' };
    return { success: true, path, token: data.token };
}
