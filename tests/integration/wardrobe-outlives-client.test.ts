// @vitest-environment node
/**
 * A wardrobe outlives the client who leaves — garments, lookbooks and photos
 * included (owner decisions, 2026-09-26). Against the live schema.
 *
 * What happened instead: the wardrobe row survived (owner_id SET NULL), but
 * wardrobe_items.user_id and lookbooks.user_id cascaded from her profile, and
 * deleteAccount deleted every photo under her folder. What outlived her was an
 * empty wardrobe. On reassignment, photos under the previous owner's folder
 * stayed there, where the bucket policy lets only that previous owner read.
 *
 * The photos move to wardrobe/<wardrobeId>/, which the bucket policy opens to
 * whoever owns the wardrobe now, and to admins. What is personal to her —
 * avatar, measurements, garments and lookbooks in no wardrobe, files nothing
 * references — still goes.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser, expectMigrationApplied } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLIENT = id(1);
const OLD_OWNER = id(2);
const NEW_OWNER = id(3);
const W = id(101);
const W2 = id(102);
const PUBLIC = 'https://project.supabase.co/storage/v1/object/public/studio-wardrobe/';

const { state, buckets, failMoves, failReads } = vi.hoisted(() => ({
    state: { db: null as PGlite | null, user: null as string | null },
    buckets: {} as Record<string, Set<string>>,
    failMoves: new Set<string>(),
    /** Tables whose reads fail, as a dropped connection would. */
    failReads: new Set<string>(),
}));

function bucket(name: string) {
    buckets[name] ??= new Set();
    const objects = buckets[name];
    return {
        list: async (prefix: string, { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}) => {
            const inside = [...objects].filter(p => p.startsWith(`${prefix}/`)).map(p => p.slice(prefix.length + 1));
            const entries = new Map<string, { name: string; id: string | null }>();
            for (const rest of inside) {
                const [head, ...tail] = rest.split('/');
                entries.set(head, { name: head, id: tail.length ? null : `id-${head}` });
            }
            return { data: [...entries.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(offset, offset + limit), error: null };
        },
        remove: async (paths: string[]) => { paths.forEach(p => objects.delete(p)); return { data: [], error: null }; },
        move: async (from: string, to: string) => {
            if (failMoves.has(from)) return { data: null, error: { message: 'storage unavailable' } };
            if (!objects.has(from)) return { data: null, error: { message: 'Object not found' } };
            if (objects.has(to)) return { data: null, error: { message: 'The resource already exists' } };
            objects.delete(from); objects.add(to);
            return { data: { message: 'moved' }, error: null };
        },
    };
}

function admin() {
    const client = pgliteSupabase(state.db!);
    const failed = { data: null, error: { message: 'connection reset' } };
    return {
        from: (table: string) => failReads.has(table)
            ? { select: () => ({ eq: async () => failed }) }
            : client.from(table),
        rpc: client.rpc.bind(client),
        storage: { from: bucket },
        auth: {
            admin: {
                deleteUser: async (uid: string) => {
                    await state.db!.query('DELETE FROM auth.users WHERE id = $1', [uid]);
                    return { error: null };
                },
            },
        },
    };
}

vi.mock('@/utils/supabase/admin-client', () => ({ createSupabaseAdminClient: () => admin() }));
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => admin() }));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: async () => ({ data: { user: state.user ? { id: state.user } : null } }),
            signOut: async () => ({ error: null }),
        },
    }),
}));
vi.mock('@/app/lib/auth-guards', () => ({ requireAdmin: async () => ({ ok: true }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { deleteAccount } from '@/app/actions/vault/account';
import { assignWardrobe } from '@/app/actions/wardrobes';

const db = () => state.db!;
const rows = async (sql: string, params: unknown[] = []) => (await db().query<Record<string, unknown>>(sql, params)).rows;

beforeAll(async () => {
    state.db = await createLiveSchemaDb();
    // Applied to production 2026-09-26.
    await expectMigrationApplied(state.db, '20260926_33_wardrobe_outlives_client.sql');
}, 60000);

afterAll(async () => { await state.db?.close(); });


describe('a client closes her account', () => {
    beforeAll(async () => {
        await createUser(db(), CLIENT, { active_studio_client: true });
        await db().query(`INSERT INTO wardrobes (id, owner_id, title, status) VALUES ($1, $2, 'Hers', 'active')`, [W, CLIENT]);
        await db().query(
            `INSERT INTO wardrobe_items (id, user_id, wardrobe_id, image_url) VALUES
                ($1, $4, $5, '${CLIENT}/a.jpg'),
                ($2, $4, $5, '${PUBLIC}${CLIENT}/b.jpg'),
                ($3, $4, NULL, '${CLIENT}/c.jpg'),
                ($6, $4, $5, '${CLIENT}/fail.jpg')`,
            [id(201), id(202), id(203), CLIENT, W, id(204)]);
        await db().query(
            `INSERT INTO lookbooks (id, user_id, wardrobe_id, title, thumbnail_url, lookbook_items) VALUES
                ($1, $3, $4, 'Autumn', '${PUBLIC}${CLIENT}/thumb.jpg', $5::jsonb),
                ($2, $3, NULL, 'Loose', NULL, '[]'::jsonb)`,
            [id(301), id(302), CLIENT, W, JSON.stringify([{ id: 'x', image_url: `${CLIENT}/a.jpg`, x: 10 }])]);
        await db().query(`INSERT INTO tailor_cards (user_id, measurements) VALUES ($1, '{"waist": 70}')`, [CLIENT]);
    });

    // One closure, inspected by several tests: run it once.
    let result: Awaited<ReturnType<typeof deleteAccount>>;
    beforeAll(async () => {
        buckets['studio-wardrobe'] = new Set([`${CLIENT}/a.jpg`, `${CLIENT}/b.jpg`, `${CLIENT}/c.jpg`, `${CLIENT}/thumb.jpg`, `${CLIENT}/stray.jpg`, `${CLIENT}/fail.jpg`, `${OLD_OWNER}/keep.jpg`]);
        buckets['avatars'] = new Set([`${CLIENT}/avatar.png`]);
        failMoves.add(`${CLIENT}/fail.jpg`);
        state.user = CLIENT;
        result = await deleteAccount();
    });

    it('closes the account', async () => {
        expect(result.success).toBe(true);
        expect(await rows('SELECT 1 FROM auth.users WHERE id = $1', [CLIENT])).toHaveLength(0);
    });

    it('keeps the wardrobe with its garments and its lookbook', async () => {
        expect(await rows('SELECT 1 FROM wardrobes WHERE id = $1', [W])).toHaveLength(1);
        expect((await rows('SELECT id FROM wardrobe_items WHERE wardrobe_id = $1 ORDER BY id', [W])).map(r => r.id)).toEqual([id(201), id(202), id(204)]);
        expect(await rows('SELECT 1 FROM lookbooks WHERE id = $1', [id(301)])).toHaveLength(1);
    });

    it('moves the wardrobe’s photos into its own folder and points everything at them', async () => {
        const objects = buckets['studio-wardrobe'];
        expect([...objects].filter(p => p.startsWith(`wardrobe/${W}/`)).sort())
            .toEqual([`wardrobe/${W}/a.jpg`, `wardrobe/${W}/b.jpg`, `wardrobe/${W}/thumb.jpg`]);
        const items = await rows('SELECT id, image_url FROM wardrobe_items WHERE id = ANY($1::uuid[]) ORDER BY id', [[id(201), id(202)]]);
        expect(items.map(r => r.image_url)).toEqual([`wardrobe/${W}/a.jpg`, `wardrobe/${W}/b.jpg`]);
        const [lb] = await rows('SELECT thumbnail_url, lookbook_items FROM lookbooks WHERE id = $1', [id(301)]);
        expect(lb.thumbnail_url).toBe(`wardrobe/${W}/thumb.jpg`);
        expect((lb.lookbook_items as { image_url: string }[])[0].image_url).toBe(`wardrobe/${W}/a.jpg`);
    });

    it('never deletes a photo it could not move, and says the cleanup was incomplete', async () => {
        expect(buckets['studio-wardrobe'].has(`${CLIENT}/fail.jpg`)).toBe(true);
        const [d] = await rows('SELECT image_url FROM wardrobe_items WHERE id = $1', [id(204)]);
        expect(d.image_url).toBe(`${CLIENT}/fail.jpg`);
        expect(result).toMatchObject({ success: true, storageCleanupFailed: true });
    });

    it('still deletes what is hers alone: avatar, loose files, measurements, and garments and lookbooks in no wardrobe', async () => {
        expect(buckets['avatars'].size).toBe(0);
        expect(buckets['studio-wardrobe'].has(`${CLIENT}/stray.jpg`)).toBe(false);
        expect(buckets['studio-wardrobe'].has(`${CLIENT}/c.jpg`)).toBe(false);
        expect(await rows('SELECT 1 FROM wardrobe_items WHERE id = $1', [id(203)])).toHaveLength(0);
        expect(await rows('SELECT 1 FROM lookbooks WHERE id = $1', [id(302)])).toHaveLength(0);
        expect(await rows('SELECT 1 FROM tailor_cards WHERE user_id = $1', [CLIENT])).toHaveLength(0);
        // Someone else's files are never touched.
        expect(buckets['studio-wardrobe'].has(`${OLD_OWNER}/keep.jpg`)).toBe(true);
    });
});

describe('when moving the photos cannot even start', () => {
    // The near-miss found while building this: an unexpected failure aborted
    // the relocation, and the cleanup then deleted her folder anyway,
    // including photos the surviving wardrobe still pointed at.
    it('closes the account but leaves her wardrobe folder whole', async () => {
        const CLIENT2 = id(9);
        const W9 = id(109);
        await createUser(db(), CLIENT2);
        await db().query(`INSERT INTO wardrobes (id, owner_id, title, status) VALUES ($1, $2, 'Hers too', 'active')`, [W9, CLIENT2]);
        await db().query(`INSERT INTO wardrobe_items (user_id, wardrobe_id, image_url) VALUES ($1, $2, $3)`, [CLIENT2, W9, `${CLIENT2}/p.jpg`]);
        buckets['studio-wardrobe'] = new Set([`${CLIENT2}/p.jpg`]);
        buckets['avatars'] = new Set([`${CLIENT2}/avatar.png`]);
        failMoves.clear();
        failReads.add('lookbooks');
        state.user = CLIENT2;
        try {
            const result = await deleteAccount();

            expect(result).toMatchObject({ success: true, storageCleanupFailed: true });
            expect(buckets['studio-wardrobe'].has(`${CLIENT2}/p.jpg`)).toBe(true);
            expect(buckets['avatars'].size).toBe(0);
            const [item] = await rows('SELECT image_url FROM wardrobe_items WHERE wardrobe_id = $1', [W9]);
            expect(item.image_url).toBe(`${CLIENT2}/p.jpg`);
        } finally {
            failReads.clear();
        }
    });
});

describe('a wardrobe moves to another client', () => {
    it('takes its photos with it, into its own folder', async () => {
        await createUser(db(), OLD_OWNER);
        await createUser(db(), NEW_OWNER);
        await db().query(`INSERT INTO wardrobes (id, owner_id, title, status) VALUES ($1, $2, 'Moving', 'active')`, [W2, OLD_OWNER]);
        await db().query(`INSERT INTO wardrobe_items (id, user_id, wardrobe_id, image_url) VALUES ($1, $2, $3, $4)`,
            [id(401), OLD_OWNER, W2, `${OLD_OWNER}/x.jpg`]);
        buckets['studio-wardrobe'] = new Set([`${OLD_OWNER}/x.jpg`]);
        failMoves.clear();

        expect(await assignWardrobe(W2, NEW_OWNER)).toEqual({ success: true });

        expect(buckets['studio-wardrobe'].has(`wardrobe/${W2}/x.jpg`)).toBe(true);
        const [item] = await rows('SELECT user_id, image_url FROM wardrobe_items WHERE id = $1', [id(401)]);
        expect(item).toEqual({ user_id: NEW_OWNER, image_url: `wardrobe/${W2}/x.jpg` });
    });
});
