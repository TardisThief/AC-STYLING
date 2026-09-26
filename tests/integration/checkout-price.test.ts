// @vitest-environment node
/**
 * What a checkout may sell, against the live schema.
 *
 * createCheckoutSession and createGuestCheckoutSession took the Stripe price
 * id from the browser and handed it straight to Stripe. A server action is
 * callable directly with any arguments, so hiding a button did not stop
 * anyone buying any ACTIVE price in the Stripe account: an unpublished
 * masterclass, a retired offer, or a cheaper old price still attached to a
 * product that grants access — and the renewal ladder then prices every later
 * year off whatever was paid. Found by the 2026-09-25 external assessment
 * (PAY-004).
 *
 * A price is sellable when the catalogue is selling it: an active offer, a
 * published masterclass or chapter, or an active service. The return paths
 * are appended to the site origin, so they must also stay on the site.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const BUYER = '00000000-0000-4000-8000-00000000c001';

const { state, sessionsCreate } = vi.hoisted(() => ({
    state: { db: null as PGlite | null },
    sessionsCreate: vi.fn(),
}));

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: () => pgliteSupabase(state.db!),
}));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: async () => ({
                data: { user: { id: BUYER, email: 'buyer@example.invalid', is_anonymous: false } },
            }),
        },
    }),
}));
vi.mock('@/utils/stripe', () => ({
    stripe: { checkout: { sessions: { create: sessionsCreate } } },
}));
vi.mock('next/headers', () => ({
    headers: async () => ({ get: (k: string) => (k.toLowerCase() === 'origin' ? 'https://www.theacstyle.com' : null) }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { createCheckoutSession, createGuestCheckoutSession, createRenewalCheckoutSession } from '@/app/actions/stripe';

const SELLABLE = {
    'an active offer': 'price_offer_active',
    'a published masterclass': 'price_mc_published',
    'a published chapter': 'price_ch_published',
    'an active service': 'price_svc_active',
};
const NOT_SELLABLE = {
    'a retired offer': 'price_offer_retired',
    'an unpublished masterclass': 'price_mc_draft',
    'an unpublished chapter': 'price_ch_draft',
    'a retired service': 'price_svc_retired',
    'a price the catalogue never heard of': 'price_1CheapLegacy',
};

beforeAll(async () => {
    const db = await createLiveSchemaDb();
    state.db = db;
    await createUser(db, BUYER);
    await db.exec(`
        INSERT INTO offers (slug, title, price_id, active) VALUES
            ('masterclass_pass', 'Pass', 'price_offer_active', true),
            ('full_access', 'Full', 'price_offer_retired', false);
        INSERT INTO masterclasses (title, price_id, is_published) VALUES
            ('Published', 'price_mc_published', true),
            ('Draft', 'price_mc_draft', false);
        INSERT INTO chapters (slug, title, video_id, price_id, is_published) VALUES
            ('published-course', 'Published', 'pending_video', 'price_ch_published', true),
            ('draft-course', 'Draft', 'pending_video', 'price_ch_draft', false);
        INSERT INTO services (title, price_id, active) VALUES
            ('Styling', 'price_svc_active', true),
            ('Old service', 'price_svc_retired', false);
    `);
}, 60000);

afterAll(async () => { await state.db?.close(); });

beforeEach(() => {
    sessionsCreate.mockReset();
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test' });
});

const buy = {
    member: (price: string, returnUrl = '/en/vault-access') => createCheckoutSession(price, returnUrl),
    guest: (price: string, returnUrl = '/en/vault-access', welcome = '/en/welcome') =>
        createGuestCheckoutSession(price, returnUrl, welcome, 'en'),
};

describe.each(Object.keys(buy) as (keyof typeof buy)[])('%s checkout', who => {
    it.each(Object.entries(SELLABLE))('sells %s', async (_, price) => {
        const result = await buy[who](price);

        expect(result).toEqual({ url: expect.any(String) });
        expect(sessionsCreate).toHaveBeenCalledTimes(1);
        expect(sessionsCreate.mock.calls[0][0].line_items).toEqual([{ price, quantity: 1 }]);
    });

    it.each(Object.entries(NOT_SELLABLE))('refuses %s', async (_, price) => {
        const result = await buy[who](price);

        expect(result).toHaveProperty('error');
        expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it.each(['//attacker.invalid/x', '@attacker.invalid/x', 'https://attacker.invalid/x'])(
        'refuses a return path that leaves the site: %s',
        async returnUrl => {
            const result = await buy[who]('price_offer_active', returnUrl);

            expect(result).toHaveProperty('error');
            expect(sessionsCreate).not.toHaveBeenCalled();
        }
    );
});

describe('guest checkout', () => {
    it('refuses a welcome path that leaves the site', async () => {
        const result = await buy.guest('price_offer_active', '/en/vault-access', '@attacker.invalid/steal');

        expect(result).toHaveProperty('error');
        expect(sessionsCreate).not.toHaveBeenCalled();
    });
});

describe('renewal checkout', () => {
    // Priced from her own purchase history, so there is no price to check —
    // but its return path is appended to the origin exactly like the others.
    it('refuses a return path that leaves the site', async () => {
        const result = await createRenewalCheckoutSession('@attacker.invalid/x');

        expect(result).toEqual({ error: 'Invalid return path' });
        expect(sessionsCreate).not.toHaveBeenCalled();
    });
});
