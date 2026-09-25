// @vitest-environment node
/**
 * What a Studio client can save from her own view, against the live schema.
 *
 * The client view (ClientStudioDashboard) lets her edit her measurements
 * (TailorCardUser) and her items' category, brand, tags and note
 * (VirtualWardrobe with isClientView). Both used to write straight from her
 * browser, beside a comment saying "RLS already scopes it to rows it owns" —
 * but members have no write policy on tailor_cards and no UPDATE policy on
 * wardrobe_items. The measurement save failed outright; every item edit
 * updated nothing and reported success, so it looked saved and was gone on
 * reload (recorded as it.fails in 3d8df58).
 *
 * Both now go through guarded actions (app/actions/client-studio.ts). The
 * browser path's refusal is pinned below so nobody "simplifies" back to it.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const h = vi.hoisted(() => ({ db: null as unknown, userId: null as string | null }));

vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => {
        const { pgliteSupabase: client } = await import('../utils/pglite-supabase');
        const base = client(h.db as never, 'authenticated', h.userId);
        return {
            from: (t: string) => base.from(t),
            auth: { getUser: async () => ({ data: { user: h.userId ? { id: h.userId } : null } }) },
        };
    },
}));
vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: () => pgliteSupabase(h.db as never, 'service_role'),
}));

import { saveMyMeasurements, updateMyWardrobeItem } from '@/app/actions/client-studio';

const CLIENT = '00000000-0000-4000-8000-00000000d001';
const OTHER = '00000000-0000-4000-8000-00000000d002';
const MEMBER = '00000000-0000-4000-8000-00000000d003';
const WARDROBE = '00000000-0000-4000-8000-00000000d101';
const OTHER_WARDROBE = '00000000-0000-4000-8000-00000000d102';
const ITEM = '00000000-0000-4000-8000-00000000d201';
const OTHER_ITEM = '00000000-0000-4000-8000-00000000d202';
// Still carries her user_id, but its wardrobe now belongs to someone else —
// what a reassignment leaves if moving the items' user_id did not happen.
const MOVED_ITEM = '00000000-0000-4000-8000-00000000d203';
let db: PGlite;

async function itemRow(id: string) {
    const { rows } = await db.query<{ client_note: string; status: string; notes: string | null; internal_note: string | null; wardrobe_id: string }>(
        'SELECT client_note, status, notes, internal_note, wardrobe_id FROM wardrobe_items WHERE id = $1', [id]);
    return rows[0];
}

async function measurementsOf(user: string) {
    const { rows } = await db.query<{ measurements: Record<string, string> }>('SELECT measurements FROM tailor_cards WHERE user_id = $1', [user]);
    return rows[0]?.measurements;
}

beforeAll(async () => {
    db = await createLiveSchemaDb();
    h.db = db;
    await createUser(db, CLIENT, { active_studio_client: true });
    await createUser(db, OTHER, { active_studio_client: true });
    await createUser(db, MEMBER);
    await db.query('INSERT INTO wardrobes (id, owner_id) VALUES ($1, $2), ($3, $4)', [WARDROBE, CLIENT, OTHER_WARDROBE, OTHER]);
    await db.query(
        `INSERT INTO wardrobe_items (id, wardrobe_id, user_id, image_url, client_note, status, notes, internal_note)
         VALUES ($1, $2, $3, 'x', 'before', 'Keep', 'stylist says', 'private'), ($4, $5, $6, 'x', 'theirs', 'Keep', NULL, NULL)`,
        [ITEM, WARDROBE, CLIENT, OTHER_ITEM, OTHER_WARDROBE, OTHER]);
    await db.query(`INSERT INTO wardrobe_items (id, wardrobe_id, user_id, image_url, client_note) VALUES ($1, $2, $3, 'x', 'moved')`, [MOVED_ITEM, OTHER_WARDROBE, CLIENT]);
}, 120_000);

afterAll(async () => { await db?.close(); });

describe('Her browser cannot write these directly, so the Studio must not try', () => {
    it('refuses her measurement upsert', async () => {
        await expect(asRole(db, 'authenticated', CLIENT,
            `INSERT INTO tailor_cards (user_id, measurements) VALUES ($1, '{"waist":"70"}')
             ON CONFLICT (user_id) DO UPDATE SET measurements = EXCLUDED.measurements RETURNING id`, [CLIENT]))
            .rejects.toMatchObject({ code: '42501' });
    });
    it('turns her item update into a silent no-op', async () => {
        const { rows } = await asRole(db, 'authenticated', CLIENT, `UPDATE wardrobe_items SET client_note = 'after' WHERE id = $1 RETURNING id`, [ITEM]);
        expect(rows).toEqual([]);
    });
});

describe('saveMyMeasurements', () => {
    it('saves a Studio client’s measurements', async () => {
        h.userId = CLIENT;
        expect(await saveMyMeasurements({ waist: ' 70 ', height: '170' })).toEqual({ success: true });
        expect(await measurementsOf(CLIENT)).toEqual({ waist: '70', height: '170' });
    });
    it('refuses a member who is not a Studio client', async () => {
        h.userId = MEMBER;
        expect((await saveMyMeasurements({ waist: '70' })).success).toBe(false);
        expect(await measurementsOf(MEMBER)).toBeUndefined();
    });
    it('refuses keys that are not measurements, and oversized values', async () => {
        h.userId = CLIENT;
        expect((await saveMyMeasurements({ waist: '70', is_admin: 'true' })).success).toBe(false);
        expect((await saveMyMeasurements({ waist: 'x'.repeat(41) })).success).toBe(false);
        expect((await saveMyMeasurements('waist=70')).success).toBe(false);
    });
    it('refuses a signed-out caller', async () => {
        h.userId = null;
        expect((await saveMyMeasurements({ waist: '70' })).success).toBe(false);
    });
});

describe('updateMyWardrobeItem', () => {
    it('saves her note on one of her own items', async () => {
        h.userId = CLIENT;
        expect(await updateMyWardrobeItem(ITEM, { client_note: 'after' })).toEqual({ success: true });
        expect((await itemRow(ITEM)).client_note).toBe('after');
    });
    it('refuses another client’s item, and leaves it untouched', async () => {
        h.userId = CLIENT;
        expect((await updateMyWardrobeItem(OTHER_ITEM, { client_note: 'mine now' })).success).toBe(false);
        expect((await itemRow(OTHER_ITEM)).client_note).toBe('theirs');
    });
    it('refuses an item in a wardrobe she no longer owns, even if it still carries her id', async () => {
        h.userId = CLIENT;
        expect((await updateMyWardrobeItem(MOVED_ITEM, { client_note: 'still mine?' })).success).toBe(false);
        expect((await itemRow(MOVED_ITEM)).client_note).toBe('moved');
    });
    it('reports failure, never success, when the write changed nothing', async () => {
        // A BEFORE UPDATE trigger returning NULL skips the row without an
        // error — the same silent no-op the browser path produced.
        await db.exec(`
            CREATE OR REPLACE FUNCTION test_skip_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
            CREATE TRIGGER test_skip_update BEFORE UPDATE ON wardrobe_items FOR EACH ROW EXECUTE FUNCTION test_skip_update();`);
        try {
            h.userId = CLIENT;
            expect((await updateMyWardrobeItem(ITEM, { client_note: 'lost' })).success).toBe(false);
        } finally {
            await db.exec('DROP TRIGGER test_skip_update ON wardrobe_items');
        }
    });
    it('writes only what she may change: not status, the stylist’s notes, or the wardrobe', async () => {
        h.userId = CLIENT;
        await updateMyWardrobeItem(ITEM, {
            client_note: 'mine', status: 'Donate', notes: 'forged', internal_note: 'read me', wardrobe_id: OTHER_WARDROBE,
        });
        expect(await itemRow(ITEM)).toMatchObject({
            client_note: 'mine', status: 'Keep', notes: 'stylist says', internal_note: 'private', wardrobe_id: WARDROBE,
        });
    });
    it('reports failure rather than success for an item that does not exist', async () => {
        h.userId = CLIENT;
        expect((await updateMyWardrobeItem('00000000-0000-4000-8000-00000000ffff', { client_note: 'x' })).success).toBe(false);
    });
    it('refuses a signed-out caller', async () => {
        h.userId = null;
        expect((await updateMyWardrobeItem(ITEM, { client_note: 'x' })).success).toBe(false);
    });
});
