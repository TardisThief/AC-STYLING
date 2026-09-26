import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveStoragePath } from '@/lib/wardrobe-images';

/**
 * Move a wardrobe's photos out of a person's folder into the wardrobe's own.
 *
 * The studio-wardrobe bucket policy (can_access_wardrobe_object) opens
 * `<userId>/…` to that one user and `wardrobe/<wardrobeId>/…` to whoever owns
 * the wardrobe now (and to admins). A wardrobe outlives the client who leaves,
 * and can move to another client (owner decisions, 2026-09-26), so photos
 * left under a person's folder end up readable by nobody but a person who is
 * gone or no longer owns the wardrobe. Here they move to the wardrobe's
 * folder, and every reference follows: garment image_url, lookbook
 * thumbnail_url, and the image paths inside a lookbook's canvas JSON.
 *
 * For each photo: move the object, then rewrite the rows. If a rewrite fails
 * the object is moved back, so a reference never points at a missing file.
 * A photo that could not be moved stays where it is, is reported, and must
 * not be deleted by the caller.
 *
 * Server-only: takes the service-role client.
 */

const BUCKET = 'studio-wardrobe';

export interface RelocationResult {
    /** Paths (old → new) that moved. */
    moved: Record<string, string>;
    /** Old paths that stayed where they were, and why. */
    failed: Record<string, string>;
}

type CanvasItem = Record<string, unknown> & { image_url?: unknown };

function under(path: string | null, folder: string): path is string {
    return !!path && path.startsWith(`${folder}/`);
}

function destination(wardrobeId: string, path: string, taken: Set<string>): string {
    const base = path.split('/').pop() || 'photo';
    let target = `wardrobe/${wardrobeId}/${base}`;
    for (let n = 2; taken.has(target); n++) target = `wardrobe/${wardrobeId}/${n}-${base}`;
    taken.add(target);
    return target;
}

export async function relocateWardrobePhotos(
    admin: SupabaseClient,
    wardrobeId: string,
    fromFolder: string
): Promise<RelocationResult> {
    const result: RelocationResult = { moved: {}, failed: {} };

    const [{ data: items, error: itemsError }, { data: lookbooks, error: lookbooksError }] = await Promise.all([
        admin.from('wardrobe_items').select('id, image_url').eq('wardrobe_id', wardrobeId),
        admin.from('lookbooks').select('id, thumbnail_url, lookbook_items').eq('wardrobe_id', wardrobeId),
    ]);
    if (itemsError || lookbooksError) {
        throw new Error(`reading wardrobe ${wardrobeId}: ${(itemsError ?? lookbooksError)!.message}`);
    }

    // Every photo of this wardrobe that still lives in the person's folder.
    const paths = new Set<string>();
    for (const i of items ?? []) {
        const p = deriveStoragePath(i.image_url as string | null);
        if (under(p, fromFolder)) paths.add(p);
    }
    for (const l of lookbooks ?? []) {
        const t = deriveStoragePath(l.thumbnail_url as string | null);
        if (under(t, fromFolder)) paths.add(t);
        for (const c of (Array.isArray(l.lookbook_items) ? l.lookbook_items : []) as CanvasItem[]) {
            const p = typeof c?.image_url === 'string' ? deriveStoragePath(c.image_url) : null;
            if (under(p, fromFolder)) paths.add(p);
        }
    }

    const storage = admin.storage.from(BUCKET);
    const taken = new Set<string>();
    for (const from of paths) {
        const to = destination(wardrobeId, from, taken);
        let moveError: { message: string } | null;
        try {
            ({ error: moveError } = await storage.move(from, to));
        } catch (e) {
            moveError = { message: e instanceof Error ? e.message : String(e) };
        }
        if (moveError) {
            result.failed[from] = moveError.message;
            continue;
        }

        const rewrite = async (): Promise<string | null> => {
            for (const i of items ?? []) {
                if (deriveStoragePath(i.image_url as string | null) !== from) continue;
                const { error } = await admin.from('wardrobe_items').update({ image_url: to }).eq('id', i.id);
                if (error) return error.message;
            }
            for (const l of lookbooks ?? []) {
                const canvas = (Array.isArray(l.lookbook_items) ? l.lookbook_items : []) as CanvasItem[];
                const thumbHit = deriveStoragePath(l.thumbnail_url as string | null) === from;
                const canvasHit = canvas.some(c => typeof c?.image_url === 'string' && deriveStoragePath(c.image_url) === from);
                if (!thumbHit && !canvasHit) continue;
                const next = canvas.map(c =>
                    typeof c?.image_url === 'string' && deriveStoragePath(c.image_url) === from ? { ...c, image_url: to } : c
                );
                const patch: Record<string, unknown> = { lookbook_items: next };
                if (thumbHit) patch.thumbnail_url = to;
                const { error } = await admin.from('lookbooks').update(patch).eq('id', l.id);
                if (error) return error.message;
                // Later photos of the same lookbook rewrite from this state.
                l.lookbook_items = next;
                if (thumbHit) l.thumbnail_url = to;
            }
            return null;
        };

        let rewriteError: string | null;
        try {
            rewriteError = await rewrite();
        } catch (e) {
            // A throw, not a returned error, must still put the file back.
            rewriteError = e instanceof Error ? e.message : String(e);
        }
        if (rewriteError) {
            // Put the file back so nothing points at a path that is gone.
            await storage.move(to, from);
            result.failed[from] = `references not updated: ${rewriteError}`;
            continue;
        }
        result.moved[from] = to;
    }

    return result;
}
