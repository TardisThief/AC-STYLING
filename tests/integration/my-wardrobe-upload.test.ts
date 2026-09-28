// @vitest-environment node
/**
 * A Studio client adding a photo to her own wardrobe, attacked against the
 * live schema.
 *
 * Owner decision 2026-09-28: her My Studio view offered the stylist's tools
 * (boutique import, the admin-only scraper, a "Change Image" her own update
 * action refuses) and its upload wrote her words into the stylist's note.
 * She now has one way to add: getMyItemUploadUrl + addMyWardrobeItem. They
 * are server actions, callable with any arguments, so these tests are the
 * inputs they exist to stop: another member's wardrobe, a path outside her
 * folder, the stylist's intake folder, an anonymous session, a full wardrobe,
 * a photo that was never uploaded, and a POSTed stylist note or status.
 *
 * Storage is the one thing faked (PGlite has no Storage API): an in-memory set
 * of object names. Ownership, the item cap, the upload rate and the insert
 * run on the real schema.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const h = vi.hoisted(() => ({
    db: null as PGlite | null,
    user: null as null | { id: string; is_anonymous?: boolean },
    objects: new Set<string>(),
}));

function withFakeStorage(client: ReturnType<typeof pgliteSupabase>) {
    const bucket = {
        createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://storage.invalid/upload/${path}`, path }, error: null }),
        list: async (folder: string, opts: { search: string }) => ({
            data: [...h.objects].filter((o) => o.startsWith(`${folder}/`) && o.endsWith(opts.search)).map((o) => ({ name: o.slice(folder.length + 1) })),
            error: null,
        }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.invalid/object/public/studio-wardrobe/${path}` } }),
    };
    return new Proxy(client, {
        get(target, prop, receiver) {
            if (prop === 'storage') return { from: () => bucket };
            return Reflect.get(target, prop, receiver);
        },
    });
}

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => withFakeStorage(pgliteSupabase(h.db!)) }));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { addMyWardrobeItem, getMyItemUploadUrl } from '@/app/actions/wardrobes';
import { MAX_ITEMS_PER_WARDROBE } from '@/app/lib/wardrobe-tokens';

let seq = 0;
const id = (n: number) => `00000000-0000-4000-8000-${String(0xe000 + n).padStart(12, '0')}`;

async function clientWithWardrobe() {
    const userId = id(++seq);
    const wardrobeId = id(++seq);
    await createUser(h.db!, userId, { active_studio_client: true });
    await h.db!.query(`INSERT INTO wardrobes (id, owner_id, title, status) VALUES ($1, $2, 'Hers', 'active')`, [wardrobeId, userId]);
    return { userId, wardrobeId };
}

/** Her browser: ask for a URL, "upload" to it, register the item. */
async function addPhoto(wardrobeId: string, extra: Record<string, unknown> = {}) {
    const url = await getMyItemUploadUrl(wardrobeId, 'coat.jpg');
    if (!url.success) return url;
    h.objects.add(url.filePath!);
    return addMyWardrobeItem({ wardrobe_id: wardrobeId, file_path: url.filePath, category: 'Outerwear', client_note: 'Winter coat', ...extra });
}

async function items(wardrobeId: string) {
    return (await h.db!.query<{ user_id: string; category: string; client_note: string; notes: string | null; status: string; image_url: string }>(
        'SELECT user_id, category, client_note, notes, status, image_url FROM wardrobe_items WHERE wardrobe_id = $1', [wardrobeId])).rows;
}

beforeAll(async () => { h.db = await createLiveSchemaDb(); }, 60000);
afterAll(async () => { await h.db?.close(); });
beforeEach(() => { h.user = null; });

describe('her own wardrobe', () => {
    it('adds the photo with her category and HER note, for the stylist to review', async () => {
        const { userId, wardrobeId } = await clientWithWardrobe();
        h.user = { id: userId };

        expect(await addPhoto(wardrobeId)).toEqual({ success: true });
        const [item] = await items(wardrobeId);
        expect(item).toMatchObject({ user_id: userId, category: 'Outerwear', client_note: 'Winter coat', status: 'inbox' });
        expect(item.notes, 'the stylist note is not hers to write').toBeNull();
        expect(item.image_url).toContain(`/${userId}/`);
    });

    it('ignores a POSTed stylist note or status', async () => {
        const { userId, wardrobeId } = await clientWithWardrobe();
        h.user = { id: userId };

        await addPhoto(wardrobeId, { notes: 'Keep this forever', status: 'Keep', internal_note: 'x' });
        const [item] = await items(wardrobeId);
        expect(item.notes).toBeNull();
        expect(item.status).toBe('inbox');
    });
});

describe('refused', () => {
    it("another member's wardrobe, at either step", async () => {
        const mine = await clientWithWardrobe();
        const theirs = await clientWithWardrobe();
        h.user = { id: mine.userId };

        expect(await getMyItemUploadUrl(theirs.wardrobeId, 'x.jpg')).toMatchObject({ success: false, error: 'not_yours' });
        const path = `${mine.userId}/planted.jpg`;
        h.objects.add(path);
        expect(await addMyWardrobeItem({ wardrobe_id: theirs.wardrobeId, file_path: path, category: 'Tops' })).toMatchObject({ success: false, error: 'not_yours' });
        expect(await items(theirs.wardrobeId)).toHaveLength(0);
    });

    it("a path in someone else's folder, or the stylist's intake folder", async () => {
        const mine = await clientWithWardrobe();
        const theirs = await clientWithWardrobe();
        h.user = { id: mine.userId };

        for (const path of [`${theirs.userId}/their-photo.jpg`, `wardrobe/${mine.wardrobeId}/intake.jpg`, `${mine.userId}/../${theirs.userId}/x.jpg`]) {
            h.objects.add(path);
            expect(await addMyWardrobeItem({ wardrobe_id: mine.wardrobeId, file_path: path, category: 'Tops' }), path)
                .toMatchObject({ success: false, error: 'invalid' });
        }
        expect(await items(mine.wardrobeId)).toHaveLength(0);
    });

    it('a photo that was never uploaded', async () => {
        const { userId, wardrobeId } = await clientWithWardrobe();
        h.user = { id: userId };
        expect(await addMyWardrobeItem({ wardrobe_id: wardrobeId, file_path: `${userId}/ghost.jpg`, category: 'Tops' }))
            .toMatchObject({ success: false, error: 'failed' });
    });

    it('an anonymous guest, and nobody', async () => {
        const { userId, wardrobeId } = await clientWithWardrobe();
        h.user = { id: userId, is_anonymous: true };
        expect(await getMyItemUploadUrl(wardrobeId, 'x.jpg')).toMatchObject({ success: false, error: 'not_yours' });
        h.user = null;
        expect(await getMyItemUploadUrl(wardrobeId, 'x.jpg')).toMatchObject({ success: false, error: 'not_yours' });
    });

    it('a full wardrobe', async () => {
        const { userId, wardrobeId } = await clientWithWardrobe();
        await h.db!.query(
            `INSERT INTO wardrobe_items (wardrobe_id, user_id, image_url) SELECT $1, $2, 'x' FROM generate_series(1, $3)`,
            [wardrobeId, userId, MAX_ITEMS_PER_WARDROBE]);
        h.user = { id: userId };
        expect(await getMyItemUploadUrl(wardrobeId, 'x.jpg')).toMatchObject({ success: false, error: 'full' });
        const path = `${userId}/late.jpg`;
        h.objects.add(path);
        expect(await addMyWardrobeItem({ wardrobe_id: wardrobeId, file_path: path, category: 'Tops' })).toMatchObject({ success: false, error: 'full' });
    });

    it('an unknown category', async () => {
        const { userId, wardrobeId } = await clientWithWardrobe();
        h.user = { id: userId };
        expect(await addPhoto(wardrobeId, { category: 'Weapons' })).toMatchObject({ success: false, error: 'invalid' });
    });
});
