// @vitest-environment node
/**
 * Payment → entitlement, attacked end to end against the live schema.
 *
 * The real webhook route (app/api/webhooks/stripe/route.ts) and the real
 * restore action (syncStripePurchases in app/actions/commerce.ts) run over
 * PGlite through tests/utils/pglite-supabase.ts. Only Stripe's network calls,
 * next/headers and email are replaced. So the unique indexes, the
 * `on_purchase_created` trigger and every write the grant path makes are the
 * production ones — which is what the unit tests, mocking all of it, cannot
 * see.
 *
 * The two outcomes that matter: someone pays and gets nothing, or gets
 * something they did not pay for. A year of access is the unit of the second:
 * since migration 21 a purchase is one year, so "granted twice" is no longer
 * harmless — it is a free year.
 *
 * Every finding here was first committed as it.fails (6ba7d7a). The two that
 * live in the schema are reproduced again in beforeAll, against the live
 * schema, before migration 23 is applied.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser, readMigration } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

type LineItem = { id: string; price: { product: string }; amount_total: number; currency: string };
type Session = {
    id: string;
    payment_status: 'paid' | 'unpaid';
    client_reference_id: string | null;
    metadata: Record<string, string>;
    customer_details: { email: string; name: string };
    line_items?: { data: LineItem[] };
};

const h = vi.hoisted(() => ({
    admin: null as unknown,
    user: null as unknown,
    sessions: [] as unknown[],
    lineItems: new Map<string, unknown[]>(),
}));

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => h.admin }));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}));
vi.mock('@/utils/stripe', () => ({
    stripe: {
        // Signatures are attacked separately, with the real SDK
        // (tests/unit/stripe-webhook-signature.test.ts).
        webhooks: { constructEvent: (body: string) => JSON.parse(body) },
        checkout: {
            sessions: {
                listLineItems: async (id: string) => ({ data: h.lineItems.get(id) ?? [] }),
                list: async () => ({ data: h.sessions }),
            },
        },
    },
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'Stripe-Signature': 'sig' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/resend', () => ({ sendEmail: vi.fn(async () => ({ success: true })) }));

import { POST } from '@/app/api/webhooks/stripe/route';
import { syncStripePurchases } from '@/app/actions/commerce';
import { claimLineItem } from '@/app/lib/fulfillment';
import { grantAccessForProduct } from '@/app/lib/access-logic';

const DAY = 24 * 60 * 60 * 1000;
let db: PGlite;
let seq = 0;

const PRODUCT = {
    masterclass: 'prod_masterclass',
    chapter: 'prod_chapter',
    masterclassPass: 'prod_masterclass_pass',
    retiredCoursePass: 'prod_course_pass',
    studioService: 'prod_studio_service',
    unknown: 'prod_matches_nothing',
};
const MASTERCLASS_ID = '00000000-0000-4000-8000-00000000a001';
const CHAPTER_ID = '00000000-0000-4000-8000-00000000a002';

async function newBuyer() {
    const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
    await createUser(db, id, { email: `buyer${seq}@example.invalid` });
    return id;
}

function session(userId: string, items: LineItem[], metadata: Record<string, string> = {}): Session {
    const s: Session = {
        id: `cs_${++seq}`,
        payment_status: 'paid',
        client_reference_id: userId,
        metadata,
        customer_details: { email: 'buyer@example.invalid', name: 'Buyer' },
        line_items: { data: items },
    };
    h.lineItems.set(s.id, items);
    return s;
}

function item(product: string): LineItem {
    return { id: `li_${++seq}`, price: { product }, amount_total: 15000, currency: 'usd' };
}

/** One Stripe delivery of `checkout.session.completed`, through the real route. */
async function deliver(s: Session, eventId = `evt_${s.id}`) {
    const body = JSON.stringify({ id: eventId, type: 'checkout.session.completed', data: { object: s } });
    const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body }));
    return res.status;
}

/** The buyer landing on ?checkout_success=true, or pressing Restore. */
async function checkoutReturn(userId: string, sessions: Session[]) {
    h.user = { id: userId, email: 'buyer@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z' };
    h.sessions = sessions;
    return syncStripePurchases();
}

/**
 * Her one grant for the masterclass. More than one row is itself a failure:
 * the renewal quote reads the soonest-expiring row, so a second row leaves her
 * being quoted — and asked to pay for — a term she has already renewed.
 */
async function masterclassGrant(userId: string) {
    const { rows } = await db.query<{ expires_at: Date; renewal_count: number }>(
        'SELECT expires_at, renewal_count FROM user_access_grants WHERE user_id = $1 AND masterclass_id = $2', [userId, MASTERCLASS_ID]);
    expect(rows, 'grant rows for one masterclass').toHaveLength(1);
    return rows[0];
}

async function profile(userId: string) {
    const { rows } = await db.query<{ access_expires_at: Date | null; access_renewal_count: number; has_masterclass_pass: boolean; has_course_pass: boolean; active_studio_client: boolean }>(
        'SELECT access_expires_at, access_renewal_count, has_masterclass_pass, has_course_pass, active_studio_client FROM profiles WHERE id = $1', [userId]);
    return rows[0];
}

/** Whole years from now, to the nearest year. */
function yearsLeft(date: Date | null | undefined): number {
    if (!date) return NaN;
    return Math.round((new Date(date).getTime() - Date.now()) / (365 * DAY));
}

beforeAll(async () => {
    db = await createLiveSchemaDb();
    h.admin = pgliteSupabase(db, 'service_role');
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_only';
    delete process.env.STRIPE_FULL_ACCESS_PRODUCT_ID;

    await db.query(`INSERT INTO masterclasses (id, title, stripe_product_id, is_published) VALUES ($1, 'Colour', $2, true)`, [MASTERCLASS_ID, PRODUCT.masterclass]);
    await db.query(`INSERT INTO chapters (id, slug, title, video_id, is_standalone, stripe_product_id) VALUES ($1, 'course', 'Course', 'v', true, $2)`, [CHAPTER_ID, PRODUCT.chapter]);
    await db.query(`INSERT INTO offers (slug, title, stripe_product_id, active) VALUES ('masterclass_pass', 'Pass', $1, true), ('course_pass', 'Course Pass', $2, false)`, [PRODUCT.masterclassPass, PRODUCT.retiredCoursePass]);
    await db.query(`INSERT INTO services (title, stripe_product_id, price_id, unlocks_studio_access) VALUES ('Studio', $1, 'price_studio_service', true)`, [PRODUCT.studioService]);

    // Before migration 23, on the live schema: a second grant row for the same
    // masterclass is accepted, and a purchase of the Studio service unlocks
    // nothing. Rolled back, so the migration's duplicate check has a clean table.
    const probe = await newBuyer();
    await db.exec('BEGIN');
    try {
        await db.query('INSERT INTO user_access_grants (user_id, masterclass_id) VALUES ($1, $2), ($1, $2)', [probe, MASTERCLASS_ID]);
        await db.query('INSERT INTO purchases (user_id, product_id) VALUES ($1, $2)', [probe, PRODUCT.studioService]);
        expect((await profile(probe)).active_studio_client).toBe(false);
    } finally {
        await db.exec('ROLLBACK');
    }

    await db.exec(readMigration('20260925_23_grant_uniqueness_and_studio_unlock.sql'));
}, 60000);

afterAll(async () => { await db?.close(); });

describe('A purchase is granted once, however many times it is fulfilled', () => {
    it('grants a year on the webhook (control)', async () => {
        const buyer = await newBuyer();
        expect(await deliver(session(buyer, [item(PRODUCT.masterclass)]))).toBe(200);
        expect(yearsLeft((await masterclassGrant(buyer)).expires_at)).toBe(1);
    });

    it('skips a second delivery of the same event', async () => {
        const buyer = await newBuyer();
        const s = session(buyer, [item(PRODUCT.masterclass)]);
        await deliver(s);
        await deliver(s);
        expect(yearsLeft((await masterclassGrant(buyer)).expires_at)).toBe(1);
    });

    it('grants one year when the same event is delivered twice at once', async () => {
        const buyer = await newBuyer();
        const s = session(buyer, [item(PRODUCT.masterclass)]);
        await Promise.all([deliver(s), deliver(s)]);
        expect(yearsLeft((await masterclassGrant(buyer)).expires_at)).toBe(1);
    });

    // CheckoutSyncHandler runs syncStripePurchases on every
    // ?checkout_success=true, i.e. on every completed checkout, and it
    // re-grants every paid session in the last 100.
    it('does not add a second year to a masterclass when the buyer returns from checkout', async () => {
        const buyer = await newBuyer();
        const s = session(buyer, [item(PRODUCT.masterclass)]);
        await deliver(s);
        await checkoutReturn(buyer, [s]);
        expect(yearsLeft((await masterclassGrant(buyer)).expires_at)).toBe(1);
    });

    it('does not add a second year to the Masterclass Pass when the buyer returns from checkout', async () => {
        const buyer = await newBuyer();
        const s = session(buyer, [item(PRODUCT.masterclassPass)]);
        await deliver(s);
        await checkoutReturn(buyer, [s]);
        expect(yearsLeft((await profile(buyer)).access_expires_at)).toBe(1);
    });

    it('does not add a year each time Restore is pressed', async () => {
        const buyer = await newBuyer();
        const s = session(buyer, [item(PRODUCT.masterclass)]);
        await checkoutReturn(buyer, [s]); // the webhook never arrived: restore is the recovery path
        await checkoutReturn(buyer, [s]);
        await checkoutReturn(buyer, [s]);
        expect(yearsLeft((await masterclassGrant(buyer)).expires_at)).toBe(1);
    });

    it('does not reset the renewal ladder when a renewal is restored', async () => {
        const buyer = await newBuyer();
        const first = session(buyer, [item(PRODUCT.masterclass)]);
        const renewal = session(buyer, [item(PRODUCT.masterclass)], { kind: 'renewal' });
        await deliver(first);
        await deliver(renewal);
        expect(await masterclassGrant(buyer)).toMatchObject({ renewal_count: 1 });

        await checkoutReturn(buyer, [renewal, first]);
        const grant = await masterclassGrant(buyer);
        expect(grant.renewal_count).toBe(1);
        expect(yearsLeft(grant.expires_at)).toBe(2);
    });

    it('grants one year when the webhook and the checkout return race', async () => {
        const buyer = await newBuyer();
        const s = session(buyer, [item(PRODUCT.masterclass)]);
        await Promise.all([deliver(s), checkoutReturn(buyer, [s])]);
        expect(yearsLeft((await masterclassGrant(buyer)).expires_at)).toBe(1);
    });
});

describe('Exactly one caller owns a line item', () => {
    // Both reads land before either write, which is the window a
    // read-then-write claim loses in.
    async function simultaneousClaims(existing: 'new' | 'abandoned' | 'failed') {
        const buyer = await newBuyer();
        const li = item(PRODUCT.masterclass);
        const ref = { lineItemId: li.id, sessionId: 'cs_x', eventId: 'evt_x', userId: buyer, productId: PRODUCT.masterclass };
        if (existing !== 'new') {
            await db.query(
                `INSERT INTO fulfillments (stripe_line_item_id, stripe_session_id, stripe_event_id, user_id, stripe_product_id, status, attempts, updated_at)
                 VALUES ($1, 'cs_x', 'evt_x', $2, $3, $4, 1, now() - interval '1 hour')`,
                [li.id, buyer, PRODUCT.masterclass, existing === 'abandoned' ? 'processing' : 'failed']);
        }
        const outcomes = await Promise.all([claimLineItem(h.admin as never, ref), claimLineItem(h.admin as never, ref)]);
        return outcomes.map(o => o.state).sort();
    }

    it.each(['new', 'abandoned', 'failed'] as const)('gives a %s line item to one of two simultaneous claimers', async existing => {
        expect(await simultaneousClaims(existing)).toEqual(['claimed', 'in_progress']);
    });
});

describe('Renewals and existing access', () => {
    it('extends the term she holds when she renews a single masterclass', async () => {
        const buyer = await newBuyer();
        await deliver(session(buyer, [item(PRODUCT.masterclass)]));
        await deliver(session(buyer, [item(PRODUCT.masterclass)], { kind: 'renewal' }));
        const grant = await masterclassGrant(buyer);
        expect(grant.renewal_count).toBe(1);
        expect(yearsLeft(grant.expires_at)).toBe(2);
    });

    it('does not put an end date on a perpetual single-item grant when she buys the item', async () => {
        const buyer = await newBuyer();
        await db.query(`INSERT INTO user_access_grants (user_id, masterclass_id, grant_type) VALUES ($1, $2, 'admin_override')`, [buyer, MASTERCLASS_ID]);
        await deliver(session(buyer, [item(PRODUCT.masterclass)]));
        expect((await masterclassGrant(buyer)).expires_at).toBeNull();
    });

    // Two paid renewals landing together — two line items, or the webhook and
    // a restore of a different session. Each read-then-write sees the same
    // held term, so one of the two paid years vanished.
    it('keeps both years when two renewals of one masterclass land at once', async () => {
        const buyer = await newBuyer();
        await deliver(session(buyer, [item(PRODUCT.masterclass)]));
        await Promise.all([
            grantAccessForProduct(h.admin as never, buyer, PRODUCT.masterclass, undefined, true),
            grantAccessForProduct(h.admin as never, buyer, PRODUCT.masterclass, undefined, true),
        ]);
        const grant = await masterclassGrant(buyer);
        expect(yearsLeft(grant.expires_at)).toBe(3);
        expect(grant.renewal_count).toBe(2);
    });

    it('keeps both years when two renewals of a pass land at once', async () => {
        const buyer = await newBuyer();
        await deliver(session(buyer, [item(PRODUCT.masterclassPass)]));
        await Promise.all([
            grantAccessForProduct(h.admin as never, buyer, PRODUCT.masterclassPass, undefined, true),
            grantAccessForProduct(h.admin as never, buyer, PRODUCT.masterclassPass, undefined, true),
        ]);
        const p = await profile(buyer);
        expect(yearsLeft(p.access_expires_at)).toBe(3);
        expect(p.access_renewal_count).toBe(2);
    });

    // Migration 21: a NULL expiry is perpetual access, sold before the term
    // existed. The three pass flags share that one column.
    it('does not put an end date on a pre-term full unlock when she buys another pass', async () => {
        const buyer = await newBuyer();
        await db.query('UPDATE profiles SET has_full_unlock = true WHERE id = $1', [buyer]);
        await deliver(session(buyer, [item(PRODUCT.masterclassPass)]));
        expect((await profile(buyer)).access_expires_at).toBeNull();
    });
});

describe('Paid means granted', () => {
    // The fulfillments table (migration 14) exists so that a run which died
    // mid-way is redone: "a row left in processing by a crashed run is
    // deliberately re-claimable". But the crashed run also wrote the event-id
    // gate, which is only released by the catch block a crash never reaches,
    // so Stripe's redelivery is answered "Already processed" before any
    // line item is looked at.
    it('fulfils a delivery that died before granting, when Stripe redelivers it', async () => {
        const buyer = await newBuyer();
        const li = item(PRODUCT.masterclass);
        const s = session(buyer, [li]);
        const eventId = `evt_${s.id}`;
        // The state an instance recycled mid-run leaves behind, an hour ago.
        await db.query('INSERT INTO stripe_processed_events (event_id) VALUES ($1)', [eventId]);
        await db.query(
            `INSERT INTO fulfillments (stripe_line_item_id, stripe_session_id, stripe_event_id, user_id, stripe_product_id, status, attempts, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'processing', 1, now() - interval '1 hour')`,
            [li.id, s.id, eventId, buyer, PRODUCT.masterclass]);

        expect(await deliver(s, eventId)).toBe(200);
        expect(await masterclassGrant(buyer)).toBeDefined();
    });

    it('grants one year when Stripe and the buyer both take over an abandoned delivery at once', async () => {
        const buyer = await newBuyer();
        const li = item(PRODUCT.masterclass);
        const s = session(buyer, [li]);
        const eventId = `evt_${s.id}`;
        await db.query(
            `INSERT INTO fulfillments (stripe_line_item_id, stripe_session_id, stripe_event_id, user_id, stripe_product_id, status, attempts, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'processing', 1, now() - interval '1 hour')`,
            [li.id, s.id, eventId, buyer, PRODUCT.masterclass]);

        await Promise.all([deliver(s, eventId), checkoutReturn(buyer, [s])]);
        expect(yearsLeft((await masterclassGrant(buyer)).expires_at)).toBe(1);
    });

    // Offers are switched on and off in admin (migration 19: only one is
    // active at a time). `active` decides what is SOLD; a payment already
    // taken for a product that has since been switched off is still owed.
    it('honours a payment for an offer switched off after checkout', async () => {
        const buyer = await newBuyer();
        expect(await deliver(session(buyer, [item(PRODUCT.retiredCoursePass)]))).toBe(200);
        expect((await profile(buyer)).has_course_pass).toBe(true);
    });

    // The only thing that acts on services.unlocks_studio_access is the
    // on_purchase_created trigger, which matches services.price_id against
    // purchases.product_id. The webhook writes the Stripe PRODUCT id there.
    it('unlocks the Studio for a service sold as unlocking it', async () => {
        const buyer = await newBuyer();
        expect(await deliver(session(buyer, [item(PRODUCT.studioService)]))).toBe(200);
        expect((await profile(buyer)).active_studio_client).toBe(true);
    });

    it('completes only the failed item when a two-item checkout is replayed', async () => {
        const buyer = await newBuyer();
        const s = session(buyer, [item(PRODUCT.masterclass), item(PRODUCT.chapter)]);

        // Fault injection: the chapter grant fails on the first delivery only.
        await db.exec(`
            CREATE TABLE IF NOT EXISTS test_faults (chapter_id uuid);
            CREATE OR REPLACE FUNCTION test_fail_chapter_grant() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF EXISTS (SELECT 1 FROM test_faults WHERE chapter_id = NEW.chapter_id) THEN
                    RAISE EXCEPTION 'injected fault';
                END IF;
                RETURN NEW;
            END $$;
            DROP TRIGGER IF EXISTS test_fail_chapter_grant ON user_access_grants;
            CREATE TRIGGER test_fail_chapter_grant BEFORE INSERT ON user_access_grants
                FOR EACH ROW EXECUTE FUNCTION test_fail_chapter_grant();`);
        await db.query('INSERT INTO test_faults VALUES ($1)', [CHAPTER_ID]);
        try {
            expect(await deliver(s)).toBe(500);
            expect(yearsLeft((await masterclassGrant(buyer)).expires_at)).toBe(1);
        } finally {
            await db.exec('DELETE FROM test_faults');
        }

        expect(await deliver(s)).toBe(200);
        expect(yearsLeft((await masterclassGrant(buyer)).expires_at)).toBe(1);
        const { rows } = await db.query('SELECT 1 FROM user_access_grants WHERE user_id = $1 AND chapter_id = $2', [buyer, CHAPTER_ID]);
        expect(rows).toHaveLength(1);
        const { rows: purchases } = await db.query('SELECT 1 FROM purchases WHERE user_id = $1', [buyer]);
        expect(purchases).toHaveLength(2);
    });

    it('grants nothing for a product that matches no content, and does not retry it', async () => {
        const buyer = await newBuyer();
        const li = item(PRODUCT.unknown);
        expect(await deliver(session(buyer, [li]))).toBe(200);

        const { rows: grants } = await db.query('SELECT 1 FROM user_access_grants WHERE user_id = $1', [buyer]);
        expect(grants).toHaveLength(0);
        expect(await profile(buyer)).toMatchObject({ access_expires_at: null, has_masterclass_pass: false, has_course_pass: false });
        const { rows: [f] } = await db.query<{ status: string }>('SELECT status FROM fulfillments WHERE stripe_line_item_id = $1', [li.id]);
        expect(f.status).toBe('unfulfillable');
    });
});
