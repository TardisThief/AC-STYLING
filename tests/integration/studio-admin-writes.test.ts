// @vitest-environment node
/**
 * The Studio's writes, now server actions, attacked against the live schema.
 *
 * The lookbook editor, the stylist's wardrobe view and the tailor card wrote
 * straight from the browser, relying on RLS alone: no validation, whatever
 * columns the page built (2026-09-29, ARCH-001). Each write is now an
 * admin-guarded action that stores only parsed fields. A server action is
 * callable with any arguments, so these are the calls it exists to refuse.
 *
 * Only what leaves the process is replaced: storage (an in-memory set of
 * object names) and next/cache. requireAdmin reads the caller's real profile
 * through RLS.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const h = vi.hoisted(() => ({
    db: null as PGlite | null,
    user: null as null | { id: string },
    objects: new Set<string>(),
    removed: [] as string[],
}));

function withFakeStorage(client: ReturnType<typeof pgliteSupabase>) {
    const bucket = {
        createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://storage.invalid/upload/${path}`, token: 't', path }, error: null }),
        list: async (folder: string, opts: { search: string }) => ({
            data: [...h.objects].filter((o) => o.startsWith(`${folder}/`) && o.endsWith(opts.search)).map((o) => ({ name: o.slice(folder.length + 1) })),
            error: null,
        }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.invalid/object/public/studio-wardrobe/${path}` } }),
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `signed:${p}`, error: null })), error: null }),
        createSignedUrl: async (p: string) => ({ data: { signedUrl: `signed:${p}` }, error: null }),
        remove: async (paths: string[]) => { h.removed.push(...paths); return { data: [], error: null }; },
    };
    return new Proxy(client, { get: (t, prop, r) => (prop === 'storage' ? { from: () => bucket } : Reflect.get(t, prop, r)) });
}

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => withFakeStorage(pgliteSupabase(h.db!)) }));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: h.user } }) },
        from: (table: string) => pgliteSupabase(h.db!, 'authenticated', h.user?.id ?? null).from(table),
    }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { cloneLookbook, createLookbook, deleteLookbook, getLookbookThumbnailUploadUrl, saveLookbook, setLookbookStatus } from '@/app/actions/lookbooks';
import { addAdminWardrobeItem, deleteAdminWardrobeItem, getAdminItemUploadUrl, setAdminItemImage } from '@/app/actions/wardrobes';
import { saveClientMeasurements } from '@/app/actions/studio';
import { MAX_ITEMS_PER_WARDROBE } from '@/app/lib/wardrobe-tokens';

const id = (n: number) => `00000000-0000-4000-8000-${String(0xa700 + n).padStart(12, '0')}`;
const ADMIN = id(1), CLIENT = id(2), OTHER_CLIENT = id(3);
const W = id(10), OTHER_W = id(11), FULL_W = id(12);
const ITEM = id(20), OTHER_ITEM = id(21);
const LB = id(30);

let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const asAdmin = () => { h.user = { id: ADMIN }; };
const asClient = () => { h.user = { id: CLIENT }; };

beforeAll(async () => {
    db = await createLiveSchemaDb();
    h.db = db;
    await createUser(db, ADMIN, { role: 'admin' });
    await createUser(db, CLIENT, { active_studio_client: true });
    await createUser(db, OTHER_CLIENT, { active_studio_client: true });
    await db.query(`INSERT INTO wardrobes (id, owner_id, title, status) VALUES ($1, $2, 'Hers', 'active'), ($3, $4, 'Theirs', 'active'), ($5, $2, 'Full', 'active')`,
        [W, CLIENT, OTHER_W, OTHER_CLIENT, FULL_W]);
    await db.query(`INSERT INTO wardrobe_items (id, user_id, wardrobe_id, image_url) VALUES ($1, $2, $3, $5), ($4, $6, $7, 'x')`,
        [ITEM, CLIENT, W, OTHER_ITEM, `${CLIENT}/coat.jpg`, OTHER_CLIENT, OTHER_W]);
    await db.query(`INSERT INTO lookbooks (id, wardrobe_id, title, status) VALUES ($1, $2, 'Autumn', 'Draft')`, [LB, W]);
    await db.query(`INSERT INTO wardrobe_items (wardrobe_id, user_id, image_url) SELECT $1, $2, 'x' FROM generate_series(1, $3)`,
        [FULL_W, CLIENT, MAX_ITEMS_PER_WARDROBE]);
}, 60000);

afterAll(async () => { await db?.close(); });
beforeEach(() => { h.user = null; h.removed = []; });

describe('a member calling the stylist’s actions is refused', () => {
    it.each([
        ['createLookbook', () => createLookbook({ wardrobe_id: W, title: 'Mine now' })],
        ['saveLookbook', () => saveLookbook({ id: LB, lookbook_items: [] })],
        ['setLookbookStatus', () => setLookbookStatus({ id: LB, status: 'Published' })],
        ['deleteLookbook', () => deleteLookbook(LB)],
        ['cloneLookbook', () => cloneLookbook(LB)],
        ['getLookbookThumbnailUploadUrl', () => getLookbookThumbnailUploadUrl(LB)],
        ['getAdminItemUploadUrl', () => getAdminItemUploadUrl(W, 'x.jpg')],
        ['addAdminWardrobeItem', () => addAdminWardrobeItem({ wardrobe_id: W, image_url: 'https://shop.example/x.jpg' })],
        ['setAdminItemImage', () => setAdminItemImage({ item_id: ITEM, image_url: 'https://shop.example/x.jpg' })],
        ['deleteAdminWardrobeItem', () => deleteAdminWardrobeItem(ITEM)],
        ['saveClientMeasurements', () => saveClientMeasurements(CLIENT, { waist: '70' })],
    ])('%s', async (_, call) => {
        asClient();
        const before = await q('SELECT count(*)::int AS n FROM lookbooks UNION ALL SELECT count(*)::int FROM wardrobe_items UNION ALL SELECT count(*)::int FROM tailor_cards');
        expect(await call()).toMatchObject({ success: false });
        expect(await q('SELECT count(*)::int AS n FROM lookbooks UNION ALL SELECT count(*)::int FROM wardrobe_items UNION ALL SELECT count(*)::int FROM tailor_cards')).toEqual(before);
        expect(await q('SELECT status FROM lookbooks WHERE id = $1', [LB])).toEqual([{ status: 'Draft' }]);
    });
});

describe('lookbooks', () => {
    it('keeps only placements of this wardrobe’s garments, and nothing else of them', async () => {
        asAdmin();
        const res = await saveLookbook({
            id: LB,
            lookbook_items: [
                { id: ITEM, x: 10, y: 20, width: 150, image_url: 'https://evil.example/x.jpg', notes: 'leak' },
                { id: OTHER_ITEM, x: 1, y: 1 },
            ],
        });
        expect(res.success).toBe(true);
        expect(await q('SELECT lookbook_items FROM lookbooks WHERE id = $1', [LB])).toEqual([{ lookbook_items: [{ id: ITEM, x: 10, y: 20, width: 150 }] }]);
    });

    it('refuses a thumbnail outside the lookbook’s wardrobe', async () => {
        asAdmin();
        expect(await saveLookbook({ id: LB, lookbook_items: [], thumbnail_path: `${OTHER_CLIENT}/thumb.jpg` }))
            .toMatchObject({ success: false, error: 'Invalid thumbnail path' });
    });

    it('creates in an existing wardrobe only, as a draft', async () => {
        asAdmin();
        expect(await createLookbook({ wardrobe_id: id(99), title: 'Nowhere' })).toMatchObject({ success: false });
        const res = await createLookbook({ wardrobe_id: W, title: 'Winter', status: 'Published', lookbook_items: [{ id: OTHER_ITEM }] });
        expect(res).toMatchObject({ success: true, data: { status: 'Draft', lookbook_items: [] } });
    });

    it('copies canvas and wardrobe into a new draft, never the id', async () => {
        asAdmin();
        const res = await cloneLookbook(LB);
        expect(res.success).toBe(true);
        const copy = res.success ? res.data! : null;
        expect(copy?.id).not.toBe(LB);
        expect(copy).toMatchObject({ wardrobe_id: W, status: 'Draft', title: 'Autumn (Copy)' });
    });

    it('publishes and deletes only what exists', async () => {
        asAdmin();
        expect(await setLookbookStatus({ id: LB, status: 'Published' })).toEqual({ success: true });
        expect(await setLookbookStatus({ id: LB, status: 'Secret' })).toMatchObject({ success: false });
        expect(await deleteLookbook(id(98))).toMatchObject({ success: false });
    });
});

describe('garments', () => {
    it('adds an uploaded photo from this wardrobe’s folder, stripping what the stylist may not set this way', async () => {
        asAdmin();
        const url = await getAdminItemUploadUrl(W, 'dress.jpg');
        h.objects.add(url.filePath!);
        const res = await addAdminWardrobeItem({ wardrobe_id: W, file_path: url.filePath, category: 'Dresses', internal_note: 'x', user_id: OTHER_CLIENT });
        expect(res.success).toBe(true);
        const [row] = await q<{ user_id: string; internal_note: string | null; category: string }>(
            'SELECT user_id, internal_note, category FROM wardrobe_items WHERE image_url LIKE $1', [`%${url.filePath}`]);
        expect(row).toEqual({ user_id: CLIENT, internal_note: null, category: 'Dresses' });
    });

    it('refuses a photo from another folder, one never uploaded, or two sources at once', async () => {
        asAdmin();
        h.objects.add(`${OTHER_CLIENT}/theirs.jpg`);
        expect(await addAdminWardrobeItem({ wardrobe_id: W, file_path: `${OTHER_CLIENT}/theirs.jpg` })).toMatchObject({ success: false, error: 'Invalid upload path' });
        expect(await addAdminWardrobeItem({ wardrobe_id: W, file_path: `${CLIENT}/ghost.jpg` })).toMatchObject({ success: false });
        expect(await addAdminWardrobeItem({ wardrobe_id: W, file_path: `${CLIENT}/coat.jpg`, image_url: 'https://shop.example/x.jpg' })).toMatchObject({ success: false });
        expect(await addAdminWardrobeItem({ wardrobe_id: W, image_url: 'javascript:alert(1)' })).toMatchObject({ success: false });
    });

    it('keeps to the item cap', async () => {
        asAdmin();
        expect(await getAdminItemUploadUrl(FULL_W, 'x.jpg')).toMatchObject({ success: false });
        expect(await addAdminWardrobeItem({ wardrobe_id: FULL_W, image_url: 'https://shop.example/x.jpg' })).toMatchObject({ success: false });
    });

    it('changes a photo only to one from the garment’s own wardrobe', async () => {
        asAdmin();
        h.objects.add(`${OTHER_CLIENT}/theirs.jpg`);
        expect(await setAdminItemImage({ item_id: ITEM, file_path: `${OTHER_CLIENT}/theirs.jpg` })).toMatchObject({ success: false });
        const res = await setAdminItemImage({ item_id: ITEM, image_url: 'https://shop.example/new.jpg' });
        expect(res.success).toBe(true);
        expect(await q('SELECT image_url FROM wardrobe_items WHERE id = $1', [ITEM])).toEqual([{ image_url: 'https://shop.example/new.jpg' }]);
    });

    it('deletes a garment with its photo, and says so when there was nothing to delete', async () => {
        asAdmin();
        await db.query(`INSERT INTO wardrobe_items (id, user_id, wardrobe_id, image_url) VALUES ($1, $2, $3, $4)`, [id(40), CLIENT, W, `${CLIENT}/gone.jpg`]);
        expect(await deleteAdminWardrobeItem(id(40))).toEqual({ success: true });
        expect(await q('SELECT 1 FROM wardrobe_items WHERE id = $1', [id(40)])).toEqual([]);
        expect(h.removed).toEqual([`${CLIENT}/gone.jpg`]);
        expect(await deleteAdminWardrobeItem(id(40))).toMatchObject({ success: false, error: 'Item not found' });
    });
});

describe('measurements', () => {
    it('stores known fields for an existing client, and refuses anything else', async () => {
        asAdmin();
        expect(await saveClientMeasurements(CLIENT, { waist: '70', password: 'x' })).toMatchObject({ success: false });
        expect(await saveClientMeasurements(id(97), { waist: '70' })).toMatchObject({ success: false, error: 'Client not found' });
        expect(await saveClientMeasurements(CLIENT, { waist: '70', hips: '96' })).toEqual({ success: true });
        expect(await q('SELECT measurements, last_updated_by FROM tailor_cards WHERE user_id = $1', [CLIENT]))
            .toEqual([{ measurements: { waist: '70', hips: '96' }, last_updated_by: ADMIN }]);
    });
});
