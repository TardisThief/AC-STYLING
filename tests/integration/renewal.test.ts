// @vitest-environment node
/**
 * Renewal, through the buyer's own RLS-scoped client, against the live schema.
 *
 * Two defects from the 2026-09-25 external assessment (PAY-005):
 *
 *  - A pass renewal looked up its offer through her session. Members can read
 *    only ACTIVE offers ("Public read active offers"), and the code's own
 *    comment says she must be able to renew a pass taken off sale since. So
 *    the moment an offer was switched off, every holder of it was told the
 *    access "cannot be renewed automatically".
 *  - A single-item renewal chose the soonest-expiring grant, lapsed or not.
 *    A masterclass that ran out months ago — past its renewal window — was
 *    the one she was quoted, and the current one could not be renewed at all.
 *
 * Passes share one term on the profile (owner decision, 2026-09-26): renewing
 * her highest pass renews the term for every pass she holds.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const DAY = 24 * 60 * 60 * 1000;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PASS_HOLDER = id(1);
const ITEM_BUYER = id(2);
const OLD_MC = id(101);
const CURRENT_MC = id(102);

const { state } = vi.hoisted(() => ({ state: { db: null as PGlite | null, user: null as string | null } }));

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => pgliteSupabase(state.db!) }));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: async () => ({
                data: { user: { id: state.user, email: 'buyer@example.invalid', is_anonymous: false } },
            }),
        },
        from: (table: string) => pgliteSupabase(state.db!, 'authenticated', state.user).from(table),
    }),
}));
vi.mock('@/utils/stripe', () => ({ stripe: { checkout: { sessions: { create: vi.fn() } } } }));
vi.mock('next/headers', () => ({ headers: async () => ({ get: () => null }) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { getRenewalQuote } from '@/app/actions/stripe';

const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();

beforeAll(async () => {
    const db = await createLiveSchemaDb();
    state.db = db;

    // A Masterclass Pass holder whose offer has since been switched off.
    await createUser(db, PASS_HOLDER, {
        has_masterclass_pass: true,
        access_expires_at: inDays(10),
        access_renewal_count: 0,
    });
    await db.query(`INSERT INTO offers (slug, title, stripe_product_id, active) VALUES ('masterclass_pass', 'Pass', 'prod_pass', false)`);
    await db.query(`INSERT INTO purchases (user_id, product_id, amount_paid, currency, status, is_renewal) VALUES ($1, 'prod_pass', 150, 'USD', 'completed', false)`, [PASS_HOLDER]);

    // A buyer of two single masterclasses: one lapsed long ago, one current.
    await createUser(db, ITEM_BUYER);
    await db.query(`INSERT INTO masterclasses (id, title, stripe_product_id, is_published) VALUES ($1, 'Old', 'prod_old', true), ($2, 'Current', 'prod_current', true)`, [OLD_MC, CURRENT_MC]);
    await db.query(`INSERT INTO user_access_grants (user_id, masterclass_id, grant_type, expires_at) VALUES ($1, $2, 'purchase', $3), ($1, $4, 'purchase', $5)`,
        [ITEM_BUYER, OLD_MC, inDays(-200), CURRENT_MC, inDays(10)]);
    await db.query(`INSERT INTO purchases (user_id, product_id, amount_paid, currency, status, is_renewal) VALUES ($1, 'prod_old', 50, 'USD', 'completed', false), ($1, 'prod_current', 80, 'USD', 'completed', false)`, [ITEM_BUYER]);
}, 60000);

afterAll(async () => { await state.db?.close(); });

describe('renewal quote', () => {
    it('renews a pass whose offer has been taken off sale', async () => {
        state.user = PASS_HOLDER;

        const quote = await getRenewalQuote();

        expect(quote).toMatchObject({ renewable: true, amountCents: 10000, currency: 'usd' });
    });

    it('quotes the current masterclass, not one that lapsed months ago', async () => {
        state.user = ITEM_BUYER;

        const quote = await getRenewalQuote();

        // Two thirds of the 80 she paid for the current one.
        expect(quote).toMatchObject({ renewable: true, amountCents: 5333 });
    });
});
