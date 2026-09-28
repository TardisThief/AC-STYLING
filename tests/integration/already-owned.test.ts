// @vitest-environment node
/**
 * A member is not sold what she already holds, against the live schema.
 *
 * Found in the 2026-09-28 paid-path rehearsal: /vault-access is prerendered,
 * so it cannot know what a signed-in visitor owns, and its buttons opened a
 * Stripe checkout for a pass she already held. Nothing downstream stops a
 * second payment: the webhook grants it again and extends the term, and
 * sales are final. The owner noticed it before a customer did.
 *
 * The rule is what the Vault itself unlocks (check_access, a live term), so
 * a lapsed member can buy again, a single-masterclass buyer can still move up
 * to the pass, and a service can be booked any number of times. Admins are
 * never refused, so the owner can still run a test purchase.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const { state, sessionsCreate } = vi.hoisted(() => ({
    state: { db: null as PGlite | null, userId: '' },
    sessionsCreate: vi.fn(),
}));

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => pgliteSupabase(state.db!) }));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: async () => ({
                data: { user: state.userId ? { id: state.userId, email: 'member@example.invalid', is_anonymous: false } : null },
            }),
        },
    }),
}));
vi.mock('@/utils/stripe', () => ({ stripe: { checkout: { sessions: { create: sessionsCreate } } } }));
vi.mock('next/headers', () => ({
    headers: async () => ({ get: (k: string) => (k.toLowerCase() === 'origin' ? 'https://www.theacstyle.com' : null) }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { createCheckoutSession, createSalesPageCheckout } from '@/app/actions/stripe';

const MC = '00000000-0000-4000-8000-00000000d0a1';
const MC_OTHER = '00000000-0000-4000-8000-00000000d0a2';
const COURSE = '00000000-0000-4000-8000-00000000d0a3';
const PRICE = {
    pass: 'price_own_pass',
    full: 'price_own_full',
    masterclass: 'price_own_mc',
    otherMasterclass: 'price_own_mc_other',
    course: 'price_own_course',
    service: 'price_own_service',
};
const DAY = 24 * 60 * 60 * 1000;
let seq = 0;

async function member(profile: Record<string, unknown> = {}) {
    const id = `00000000-0000-4000-8000-${String(0xd100 + ++seq).padStart(12, '0')}`;
    await createUser(state.db!, id, profile);
    return id;
}
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

/** Click a sales-page buy button as this member. */
async function buy(userId: string, priceId: string) {
    state.userId = userId;
    return createSalesPageCheckout(priceId, '/vault', '/en/welcome', 'en');
}

beforeAll(async () => {
    const db = await createLiveSchemaDb();
    state.db = db;
    await db.query(
        `INSERT INTO offers (slug, title, price_id, active) VALUES
            ('masterclass_pass', 'Pass', $1, true), ('full_access', 'Full', $2, true)`,
        [PRICE.pass, PRICE.full]);
    await db.query(
        `INSERT INTO masterclasses (id, title, price_id, is_published) VALUES ($1, 'Colorimetry', $2, true), ($3, 'Body Shape', $4, true)`,
        [MC, PRICE.masterclass, MC_OTHER, PRICE.otherMasterclass]);
    await db.query(
        `INSERT INTO chapters (id, slug, title, video_id, price_id, is_published, is_standalone) VALUES ($1, 'course', 'Course', 'v', $2, true, true)`,
        [COURSE, PRICE.course]);
    await db.query(`INSERT INTO services (title, price_id, active) VALUES ('Styling', $1, true)`, [PRICE.service]);
}, 60000);

afterAll(async () => { await state.db?.close(); });

beforeEach(() => {
    sessionsCreate.mockReset();
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test' });
});

describe('refused: she already holds it', () => {
    it('the pass, to a member whose pass term is live', async () => {
        const id = await member({ has_masterclass_pass: true, access_expires_at: inDays(200) });
        expect(await buy(id, PRICE.pass)).toMatchObject({ alreadyOwned: true });
        expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it('a single masterclass, to a pass holder', async () => {
        const id = await member({ has_masterclass_pass: true, access_expires_at: inDays(200) });
        expect(await buy(id, PRICE.masterclass)).toMatchObject({ alreadyOwned: true });
        expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it('a masterclass she bought on its own, while its grant is live', async () => {
        const id = await member();
        await state.db!.query('INSERT INTO user_access_grants (user_id, masterclass_id, expires_at) VALUES ($1, $2, $3)', [id, MC, inDays(100)]);
        expect(await buy(id, PRICE.masterclass)).toMatchObject({ alreadyOwned: true });
        expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it('the pass, to a Full Access holder (Full Access covers it)', async () => {
        const id = await member({ has_full_unlock: true, access_expires_at: null });
        expect(await buy(id, PRICE.pass)).toMatchObject({ alreadyOwned: true });
        expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it('also inside the Vault, through createCheckoutSession directly', async () => {
        const id = await member({ has_masterclass_pass: true, access_expires_at: inDays(200) });
        state.userId = id;
        expect(await createCheckoutSession(PRICE.pass, '/vault')).toMatchObject({ alreadyOwned: true });
        expect(sessionsCreate).not.toHaveBeenCalled();
    });
});

describe('allowed: she does not hold it now', () => {
    it('the pass, to a member whose pass lapsed', async () => {
        const id = await member({ has_masterclass_pass: true, access_expires_at: inDays(-40) });
        expect(await buy(id, PRICE.pass)).toMatchObject({ url: expect.any(String) });
    });

    it('the pass, to a member who owns one masterclass (moving up)', async () => {
        const id = await member();
        await state.db!.query('INSERT INTO user_access_grants (user_id, masterclass_id, expires_at) VALUES ($1, $2, $3)', [id, MC, inDays(100)]);
        expect(await buy(id, PRICE.pass)).toMatchObject({ url: expect.any(String) });
    });

    it('a different masterclass from the one she owns', async () => {
        const id = await member();
        await state.db!.query('INSERT INTO user_access_grants (user_id, masterclass_id, expires_at) VALUES ($1, $2, $3)', [id, MC, inDays(100)]);
        expect(await buy(id, PRICE.otherMasterclass)).toMatchObject({ url: expect.any(String) });
    });

    it('a standalone course, to a masterclass pass holder (the pass does not cover it)', async () => {
        const id = await member({ has_masterclass_pass: true, access_expires_at: inDays(200) });
        expect(await buy(id, PRICE.course)).toMatchObject({ url: expect.any(String) });
    });

    it('a service, however often she has booked it', async () => {
        const id = await member({ has_full_unlock: true, access_expires_at: null });
        expect(await buy(id, PRICE.service)).toMatchObject({ url: expect.any(String) });
    });

    // A masterclass, not the pass: check_access says yes to an admin for all
    // content, so this is the case the exemption exists for. (She holds no
    // pass flag, so buying the pass would pass without it.)
    it('anything, to an admin (the owner must be able to test a purchase)', async () => {
        const id = await member({ role: 'admin' });
        expect(await buy(id, PRICE.masterclass)).toMatchObject({ url: expect.any(String) });
        expect(await buy(id, PRICE.pass)).toMatchObject({ url: expect.any(String) });
    });

    it('anything, to a visitor with no account (guest checkout)', async () => {
        state.userId = '';
        expect(await createSalesPageCheckout(PRICE.pass, '/vault', '/en/welcome', 'en')).toMatchObject({ url: expect.any(String) });
    });
});
