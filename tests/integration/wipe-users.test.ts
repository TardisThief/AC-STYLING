// @vitest-environment node
/**
 * The user wipe (scripts/wipe/wipe-core.mjs), run against the live schema.
 *
 * A wipe is irreversible, so what it must NOT touch matters as much as what
 * it removes: admins, kept testers and the whole catalog survive; a dry run
 * changes nothing; and nothing is left pointing at a wiped person — including
 * the two places a plain `DELETE FROM auth.users` would miss (wardrobes only
 * lose their owner, and sale notices keep the buyer's email).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { applyWipe, planWipe, tableCounts, wipeStorage } from '../../scripts/wipe/wipe-core.mjs';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ADMIN = id(1);
const TESTER = id(2);   // kept with --keep
const BUYER = id(3);
const CLIENT = id(4);
const MC = id(101), CH = id(102), OFFER = id(103);
const BUYER_WARDROBE = id(201), CLIENT_WARDROBE = id(202), OWNERLESS = id(203), TESTER_WARDROBE = id(204);

let db: PGlite;
const query = (sql: string, params?: unknown[]) => db.query(sql, params);

async function count(sql: string, params: unknown[] = []) {
    return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0].n;
}

/** Run fn in a transaction that is always rolled back, as the CLI's dry run does. */
async function inRollback<T>(fn: () => Promise<T>): Promise<T> {
    await db.exec('BEGIN');
    try { return await fn(); } finally { await db.exec('ROLLBACK'); }
}

beforeAll(async () => {
    db = await createLiveSchemaDb();
    // createUser gives each an email of <last 4 of id>@example.invalid.
    await createUser(db, ADMIN, { role: 'admin' });
    await createUser(db, TESTER);
    await createUser(db, BUYER, { has_masterclass_pass: true });
    await createUser(db, CLIENT, { active_studio_client: true });

    await db.query(`INSERT INTO masterclasses (id, title) VALUES ($1, 'Colour')`, [MC]);
    await db.query(`INSERT INTO chapters (id, slug, title, video_id, masterclass_id, is_standalone) VALUES ($1, 'm', 'M', 'v', $2, false)`, [CH, MC]);
    await db.query(`INSERT INTO offers (id, slug, title) VALUES ($1, 'masterclass_pass', 'Pass')`, [OFFER]);
    await db.query(`INSERT INTO services (title) VALUES ('Session')`);

    for (const u of [BUYER, TESTER]) {
        await db.query('INSERT INTO user_access_grants (user_id, masterclass_id) VALUES ($1, $2)', [u, MC]);
        await db.query(`INSERT INTO purchases (user_id, product_id) VALUES ($1, 'prod_x')`, [u]);
        await db.query(`INSERT INTO fulfillments (stripe_line_item_id, stripe_session_id, stripe_event_id, user_id, stripe_product_id) VALUES ($1, 'cs', 'evt', $2, 'prod_x')`, [`li_${u}`, u]);
        await db.query(`INSERT INTO purchase_claims (user_id, stripe_session_id, email, expires_at) VALUES ($1, $2, 'x@example.invalid', now() + interval '1 day')`, [u, `cs_${u}`]);
        await db.query(`INSERT INTO user_progress (user_id, content_id) VALUES ($1, $2)`, [u, CH]);
    }
    // A sale notice as the webhook writes it: user_id plus the buyer's contact details.
    await db.query(`INSERT INTO admin_notifications (type, title, user_id, reference_id, metadata)
                    VALUES ('masterclass_purchase', 'New Sale', $1, 'cs_buyer:li', jsonb_build_object('original_user_id', $2::text, 'email', '0003@example.invalid', 'phone', '+1 555'))`, [BUYER, BUYER]);
    // One whose user_id was already nulled, identifiable only by metadata.
    await db.query(`INSERT INTO admin_notifications (type, title, reference_id, metadata)
                    VALUES ('offer_sale', 'New Sale', 'cs_buyer2:li', jsonb_build_object('email', '0003@EXAMPLE.invalid'))`);
    await db.query(`INSERT INTO admin_notifications (type, title, reference_id) VALUES ('payment_review', 'Refund issued', 'evt_refund')`);
    await db.query(`INSERT INTO webhook_events (event_type, status) VALUES ('checkout.session.completed', 'processing')`);
    await db.query(`INSERT INTO stripe_processed_events (event_id) VALUES ('evt_1')`);

    await db.query('INSERT INTO wardrobes (id, owner_id) VALUES ($1, $2), ($3, $4), ($5, NULL), ($6, $7)',
        [BUYER_WARDROBE, BUYER, CLIENT_WARDROBE, CLIENT, OWNERLESS, TESTER_WARDROBE, TESTER]);
    // Guest-intake item: no user_id, so only the wardrobe ties it to her.
    await db.query(`INSERT INTO wardrobe_items (wardrobe_id, user_id, image_url) VALUES ($1, NULL, 'intake'), ($1, $2, 'own'), ($3, NULL, 'unassigned'), ($4, $5, 'tester')`,
        [CLIENT_WARDROBE, CLIENT, OWNERLESS, TESTER_WARDROBE, TESTER]);
    await db.query(`INSERT INTO tailor_cards (user_id, measurements) VALUES ($1, '{}')`, [CLIENT]);
}, 120_000);

afterAll(async () => { await db?.close(); });

describe('planWipe', () => {
    it('keeps every admin and every --keep account, and nobody else', async () => {
        const plan = await planWipe(query, { keepEmails: [' 0002@EXAMPLE.invalid '] });
        expect(plan.kept.map((u: { id: string }) => u.id).sort()).toEqual([ADMIN, TESTER].sort());
        expect(plan.wiped.map((u: { id: string }) => u.id).sort()).toEqual([BUYER, CLIENT].sort());
    });
    it('refuses a --keep address that matches no account, rather than wiping who it meant', async () => {
        await expect(planWipe(query, { keepEmails: ['0002@example.invaild'] })).rejects.toThrow(/do not exist/);
    });
    it('refuses to plan a wipe that would leave no admin', async () => {
        await inRollback(async () => {
            await db.query(`UPDATE profiles SET role = 'user' WHERE id = $1`, [ADMIN]);
            await expect(planWipe(query)).rejects.toThrow(/no admin/);
        });
    });
});

describe('applyWipe', () => {
    let plan: Awaited<ReturnType<typeof planWipe>>;
    beforeEach(async () => { plan = await planWipe(query, { keepEmails: ['0002@example.invalid'] }); });

    it('changes nothing when rolled back (the dry run)', async () => {
        const before = await tableCounts(query);
        await inRollback(() => applyWipe(query, plan));
        expect(await tableCounts(query)).toEqual(before);
    });

    it('leaves nothing anywhere pointing at a wiped person', async () => {
        await inRollback(async () => {
            await applyWipe(query, plan);
            const wiped = [BUYER, CLIENT];
            expect(await count('auth.users WHERE id = ANY($1::uuid[])', [wiped])).toBe(0);
            for (const table of ['user_access_grants', 'purchases', 'fulfillments', 'purchase_claims', 'user_progress', 'wardrobe_items', 'tailor_cards', 'admin_notifications']) {
                expect(await count(`public.${table} WHERE user_id = ANY($1::uuid[])`, [wiped]), table).toBe(0);
            }
            // The two a plain auth.users delete would miss:
            expect(await count(`public.wardrobes WHERE id = ANY($1::uuid[])`, [[BUYER_WARDROBE, CLIENT_WARDROBE]])).toBe(0);
            expect(await count(`public.wardrobe_items WHERE image_url = 'intake'`)).toBe(0);
            expect(await count(`public.admin_notifications WHERE metadata->>'email' ILIKE '0003@example.invalid'`)).toBe(0);
        });
    });

    it('keeps admins, kept testers and their data, the catalog, and ownerless wardrobes', async () => {
        await inRollback(async () => {
            await applyWipe(query, plan);
            expect(await count('auth.users WHERE id = ANY($1::uuid[])', [[ADMIN, TESTER]])).toBe(2);
            expect(await count('public.user_access_grants WHERE user_id = $1', [TESTER])).toBe(1);
            expect(await count('public.purchases WHERE user_id = $1', [TESTER])).toBe(1);
            expect(await count('public.wardrobe_items WHERE user_id = $1', [TESTER])).toBe(1);
            expect(await count('public.masterclasses')).toBe(1);
            expect(await count('public.chapters')).toBe(1);
            expect(await count('public.offers')).toBe(1);
            expect(await count('public.services')).toBe(1);
            expect(await count('public.wardrobes WHERE id = $1', [OWNERLESS])).toBe(1);
            expect(await count(`public.wardrobe_items WHERE image_url = 'unassigned'`)).toBe(1);
        });
    });

    it('keeps operational logs unless asked, and clears them when asked', async () => {
        await inRollback(async () => {
            await applyWipe(query, plan);
            expect(await count('public.webhook_events')).toBe(1);
            expect(await count(`public.admin_notifications WHERE type = 'payment_review'`)).toBe(1);
        });
        await inRollback(async () => {
            await applyWipe(query, plan, { clearLogs: true });
            expect(await count('public.webhook_events')).toBe(0);
            expect(await count('public.stripe_processed_events')).toBe(0);
            expect(await count(`public.admin_notifications WHERE type = 'payment_review'`)).toBe(0);
        });
    });

    it('returns exactly the wiped users’ storage folders', async () => {
        const result = await inRollback(() => applyWipe(query, plan));
        expect(new Set(result.storageFolders['studio-wardrobe'])).toEqual(new Set([
            BUYER, CLIENT, `wardrobe/${BUYER}`, `wardrobe/${CLIENT}`, `wardrobe/${BUYER_WARDROBE}`, `wardrobe/${CLIENT_WARDROBE}`,
        ]));
        expect(result.storageFolders.avatars.sort()).toEqual([BUYER, CLIENT].sort());
    });
});

describe('wipeStorage', () => {
    // A bucket as the Storage API lists it: folders have no id.
    function fakeStorage(files: Record<string, string[]>) {
        const removed: Record<string, string[]> = {};
        return {
            removed,
            from: (bucket: string) => ({
                list: async (folder: string) => {
                    const under = (files[bucket] ?? []).filter(p => p.startsWith(`${folder}/`)).map(p => p.slice(folder.length + 1));
                    const names = [...new Set(under.map(p => p.split('/')[0]))];
                    return { data: names.map(name => ({ name, id: under.includes(name) ? `id-${name}` : null })), error: null };
                },
                remove: async (paths: string[]) => { (removed[bucket] ??= []).push(...paths); return { error: null }; },
            }),
        };
    }
    const files = {
        'studio-wardrobe': [`${BUYER}/a.jpg`, `${BUYER}/lookbook-thumbs/t.jpg`, `wardrobe/${CLIENT_WARDROBE}/g.jpg`, `${TESTER}/keep.jpg`, `wardrobe/${OWNERLESS}/keep.jpg`],
        avatars: [`${BUYER}/me.png`, `${ADMIN}/me.png`],
    };
    const folders = { 'studio-wardrobe': [BUYER, `wardrobe/${CLIENT_WARDROBE}`], avatars: [BUYER] };

    it('only counts on a dry run', async () => {
        const storage = fakeStorage(files);
        expect(await wipeStorage(storage, folders)).toEqual({ 'studio-wardrobe': 3, avatars: 1 });
        expect(storage.removed).toEqual({});
    });
    it('removes exactly the wiped users’ files, nested ones included, and nobody else’s', async () => {
        const storage = fakeStorage(files);
        await wipeStorage(storage, folders, { commit: true });
        expect(storage.removed['studio-wardrobe'].sort()).toEqual([`${BUYER}/a.jpg`, `${BUYER}/lookbook-thumbs/t.jpg`, `wardrobe/${CLIENT_WARDROBE}/g.jpg`].sort());
        expect(storage.removed.avatars).toEqual([`${BUYER}/me.png`]);
    });
});
