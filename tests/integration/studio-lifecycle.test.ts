// @vitest-environment node
/**
 * Studio wardrobe lifecycle, against the live schema (2026-09-25 external
 * assessment, STUDIO-001 and STUDIO-002).
 *
 *  - Every wardrobe carries a bearer intake token (upload_token defaults to
 *    gen_random_uuid()), but only invitation.ts gave it an expiry.
 *    createWardrobe, getMyWardrobe, onboarding and Studio activation inserted
 *    wardrobes with a NULL expiry, which the token check treats as "never".
 *  - getMyWardrobe read her wardrobe with .single(). Two active wardrobes make
 *    that an error, the error read as "no wardrobe", and it created a third.
 *  - assignWardrobe made three separate writes and answered success whatever
 *    happened, including for a wardrobe that does not exist.
 *  - Signed upload URLs were limited only by registered items, so a leaked
 *    link could mint URLs (and fill the bucket with unregistered objects)
 *    without limit.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser, readMigration } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const DAY = 24 * 60 * 60 * 1000;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLIENT = id(1);
const TWO_WARDROBES = id(2);
const NEW_OWNER = id(3);

const { state } = vi.hoisted(() => ({ state: { db: null as PGlite | null, user: null as string | null } }));

function admin() {
    const client = pgliteSupabase(state.db!);
    return {
        from: client.from.bind(client),
        rpc: client.rpc.bind(client),
        storage: {
            from: () => ({
                createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://storage.invalid/${path}` }, error: null }),
            }),
        },
    };
}

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => admin() }));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: state.user ? { id: state.user } : null } }) },
        from: (table: string) => pgliteSupabase(state.db!, 'authenticated', state.user).from(table),
    }),
}));
vi.mock('@/app/lib/auth-guards', () => ({ requireAdmin: async () => ({ ok: true }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { assignWardrobe, createWardrobe, getMyWardrobe, getSignedUploadUrl } from '@/app/actions/wardrobes';

const db = () => state.db!;

beforeAll(async () => {
    state.db = await createLiveSchemaDb();
    await state.db.exec(readMigration('20260926_28_wardrobe_token_expiry_and_assignment.sql'));
    await createUser(db(), CLIENT, { active_studio_client: true });
    await createUser(db(), TWO_WARDROBES, { active_studio_client: true });
    await createUser(db(), NEW_OWNER);
    await db().query(
        `INSERT INTO wardrobes (owner_id, title, status, created_at) VALUES ($1, 'First', 'active', now() - interval '2 days'), ($1, 'Second', 'active', now())`,
        [TWO_WARDROBES]);
}, 60000);

afterAll(async () => { await state.db?.close(); });

beforeEach(() => { state.user = null; });

async function expiryOf(wardrobeId: string) {
    const { rows } = await db().query<{ upload_token_expires_at: Date | null }>('SELECT upload_token_expires_at FROM wardrobes WHERE id = $1', [wardrobeId]);
    return rows[0].upload_token_expires_at;
}

describe('intake tokens expire, however the wardrobe was made (STUDIO-002)', () => {
    it('the database gives a token an expiry when the insert does not', async () => {
        const { rows: [w] } = await db().query<{ id: string }>(`INSERT INTO wardrobes (title) VALUES ('Raw insert') RETURNING id`);

        const expiry = await expiryOf(w.id);
        expect(expiry).not.toBeNull();
        expect(new Date(expiry!).getTime() - Date.now()).toBeGreaterThan(6 * DAY);
        expect(new Date(expiry!).getTime() - Date.now()).toBeLessThanOrEqual(7 * DAY);
    });

    it('refuses an insert that explicitly sets no expiry', async () => {
        await expect(db().query(`INSERT INTO wardrobes (title, upload_token_expires_at) VALUES ('Never', NULL)`)).rejects.toMatchObject({ code: '23502' });
    });

    it('createWardrobe issues an expiring link', async () => {
        const result = await createWardrobe('New client');

        expect(result.success).toBe(true);
        expect(await expiryOf(result.wardrobe!.id)).not.toBeNull();
    });

    it('stops minting upload URLs for one wardrobe after a burst', async () => {
        const { rows: [w] } = await db().query<{ upload_token: string }>(
            `INSERT INTO wardrobes (title, status, upload_token_expires_at) VALUES ('Leaked', 'active', now() + interval '1 day') RETURNING upload_token`);

        const results = [];
        for (let i = 0; i < 61; i++) results.push(await getSignedUploadUrl(w.upload_token, `photo-${i}.jpg`));

        expect(results.slice(0, 60).every(r => r.success)).toBe(true);
        expect(results[60]).toMatchObject({ success: false });
    });
});

describe('getMyWardrobe (STUDIO-001)', () => {
    it('returns her wardrobe when she has two, instead of making a third', async () => {
        state.user = TWO_WARDROBES;

        const result = await getMyWardrobe();

        expect(result.success).toBe(true);
        expect(result.wardrobe?.title).toBe('First');
        const { rows } = await db().query('SELECT id FROM wardrobes WHERE owner_id = $1', [TWO_WARDROBES]);
        expect(rows).toHaveLength(2);
    });

    it('creates one on a Studio client’s first visit', async () => {
        state.user = CLIENT;

        const result = await getMyWardrobe();

        expect(result.success).toBe(true);
        const { rows } = await db().query('SELECT id FROM wardrobes WHERE owner_id = $1', [CLIENT]);
        expect(rows).toHaveLength(1);
    });
});

describe('assignWardrobe (STUDIO-001)', () => {
    it('moves the wardrobe, her Studio access and its items together', async () => {
        const { rows: [w] } = await db().query<{ id: string }>(`INSERT INTO wardrobes (title, status, upload_token_expires_at) VALUES ('Intake', 'active', now() + interval '1 day') RETURNING id`);
        await db().query(`INSERT INTO wardrobe_items (wardrobe_id, image_url) VALUES ($1, 'wardrobe/x/a.jpg'), ($1, 'wardrobe/x/b.jpg')`, [w.id]);

        const result = await assignWardrobe(w.id, NEW_OWNER);

        expect(result).toEqual({ success: true });
        const { rows: [owner] } = await db().query<{ owner_id: string }>('SELECT owner_id FROM wardrobes WHERE id = $1', [w.id]);
        expect(owner.owner_id).toBe(NEW_OWNER);
        const { rows: [p] } = await db().query<{ active_studio_client: boolean }>('SELECT active_studio_client FROM profiles WHERE id = $1', [NEW_OWNER]);
        expect(p.active_studio_client).toBe(true);
        const { rows: items } = await db().query('SELECT id FROM wardrobe_items WHERE wardrobe_id = $1 AND user_id = $2', [w.id, NEW_OWNER]);
        expect(items).toHaveLength(2);
    });

    it('reports failure for a wardrobe that does not exist', async () => {
        const result = await assignWardrobe(id(999), NEW_OWNER);

        expect(result.success).toBe(false);
    });
});
