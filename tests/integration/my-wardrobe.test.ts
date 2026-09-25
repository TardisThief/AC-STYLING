// @vitest-environment node
/**
 * getMyWardrobe(), run for real against the live schema: the caller's own
 * client under RLS, the service role where the action uses it.
 *
 * /vault/my-studio relies on it to auto-create a Studio client's wardrobe on
 * her first visit, and redirects her out of the Studio if it returns none.
 * A client who reaches the Studio by buying a service (the on_purchase_created
 * trigger sets active_studio_client) has no wardrobe yet.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getMyWardrobe } from '@/app/actions/wardrobes';

const CLIENT = '00000000-0000-4000-8000-00000000c001';
const MEMBER = '00000000-0000-4000-8000-00000000c002';
const HAS_ONE = '00000000-0000-4000-8000-00000000c003';
let db: PGlite;

async function wardrobesOf(owner: string) {
    return (await db.query('SELECT id FROM wardrobes WHERE owner_id = $1', [owner])).rows;
}

beforeAll(async () => {
    db = await createLiveSchemaDb();
    h.db = db;
    await createUser(db, CLIENT, { active_studio_client: true });
    await createUser(db, MEMBER);
    await createUser(db, HAS_ONE, { active_studio_client: true });
    await db.query('INSERT INTO wardrobes (owner_id, title) VALUES ($1, $2)', [HAS_ONE, 'Existing']);
}, 120_000);

afterAll(async () => { await db?.close(); });

describe('getMyWardrobe', () => {
    it('returns the wardrobe a client already has (control)', async () => {
        h.userId = HAS_ONE;
        const result = await getMyWardrobe();
        expect(result.wardrobe?.title).toBe('Existing');
        expect(await wardrobesOf(HAS_ONE)).toHaveLength(1);
    });

    // Members cannot insert wardrobes under RLS (only the admin policy
    // allows it), so the create-on-first-visit branch always failed.
    it.fails('creates a Studio client’s wardrobe on her first visit', async () => {
        h.userId = CLIENT;
        const result = await getMyWardrobe();
        expect(result.success).toBe(true);
        expect(await wardrobesOf(CLIENT)).toHaveLength(1);
    });

    it('does not create a wardrobe for a member who is not a Studio client', async () => {
        h.userId = MEMBER;
        const result = await getMyWardrobe();
        expect(result.success).toBe(false);
        expect(await wardrobesOf(MEMBER)).toHaveLength(0);
    });

    it('refuses a signed-out caller', async () => {
        h.userId = null;
        expect((await getMyWardrobe()).success).toBe(false);
    });
});
