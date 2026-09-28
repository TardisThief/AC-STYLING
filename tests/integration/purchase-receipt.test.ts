// @vitest-environment node
/**
 * Every paid checkout sends one purchase email: the welcome for a new
 * account, a receipt for everyone else. Against the live schema.
 *
 * Found in the 2026-09-28 paid-path rehearsal: a buyer whose email already
 * had a signed-in account paid and received nothing. The only purchase email
 * was the welcome, sent only to an account never signed in. Owner decision the
 * same day: everyone else gets a branded receipt in her language.
 *
 * The guard that matters is "once". Stripe redelivers, two deliveries can run
 * at once, and her checkout return can settle the line items before the
 * webhook sees them, so nothing about one delivery says whether the receipt
 * went. Migration 34 adds fulfillments.receipt_sent_at, claimed for the whole
 * session in one conditional UPDATE; these tests attack that claim.
 *
 * Only what leaves the process is replaced: Stripe, email, next/headers, and
 * the auth admin API behind guest-account resolution (PGlite has no GoTrue).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser, expectMigrationApplied } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

type LineItem = { id: string; price: { product: string }; amount_total: number; currency: string };
type Session = {
    id: string;
    payment_status: 'paid';
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
    guest: null as null | { userId: string; created: boolean; needsWayIn: boolean },
    sendEmail: null as unknown as ReturnType<typeof vi.fn<(msg: { to: string; subject: string; html: string }) => Promise<{ success: boolean; error?: string }>>>,
}));

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => h.admin }));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}));
vi.mock('@/utils/stripe', () => ({
    stripe: {
        webhooks: { constructEvent: (body: string) => JSON.parse(body) },
        checkout: {
            sessions: {
                listLineItems: async (id: string) => ({ data: h.lineItems.get(id) ?? [] }),
                list: async () => ({ data: h.sessions, has_more: false }),
            },
        },
    },
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'Stripe-Signature': 'sig' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/resend', () => {
    h.sendEmail = vi.fn(async () => ({ success: true }));
    return { sendEmail: (msg: { to: string; subject: string; html: string }) => h.sendEmail(msg) };
});
vi.mock('@/app/lib/guest-purchase', () => ({
    resolveOrCreateUserByEmail: async () => h.guest,
    generateSetPasswordLink: async () => 'https://example.invalid/set-password',
}));

import { POST } from '@/app/api/webhooks/stripe/route';
import { syncStripePurchases } from '@/app/actions/commerce';
import { getPurchaseReceiptSubject, getPurchaseWelcomeSubject } from '@/lib/email-templates';

let db: PGlite;
let seq = 0;
const PRODUCT = { masterclass: 'prod_rcpt_masterclass', pass: 'prod_rcpt_pass' };

/**
 * Whether she has signed in reaches the webhook only through the resolver's
 * `needsWayIn` (h.guest), so the PGlite auth stub needs no sign-in column.
 */
async function newMember(opts: { language?: string } = {}) {
    const id = `00000000-0000-4000-9000-${String(++seq).padStart(12, '0')}`;
    await createUser(db, id, { email: `member${seq}@example.invalid`, language_preference: opts.language ?? 'en' });
    return id;
}

function session(userId: string | null, products: string[], metadata: Record<string, string> = {}): Session {
    const items = products.map((p) => ({ id: `li_rcpt_${++seq}`, price: { product: p }, amount_total: 15000, currency: 'usd' }));
    const s: Session = {
        id: `cs_rcpt_${++seq}`,
        payment_status: 'paid',
        client_reference_id: userId,
        metadata,
        customer_details: { email: `buyer${seq}@example.invalid`, name: 'Buyer' },
        line_items: { data: items },
    };
    h.lineItems.set(s.id, items);
    return s;
}

async function deliver(s: Session, eventId = `evt_${s.id}`) {
    const body = JSON.stringify({ id: eventId, type: 'checkout.session.completed', data: { object: s } });
    return (await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body }))).status;
}

/** Subjects of the emails sent to this address, in order. */
function mailTo(email: string): string[] {
    return h.sendEmail.mock.calls
        .map((c) => c[0] as { to: string; subject: string })
        .filter((m) => m.to === email)
        .map((m) => m.subject);
}

const RECEIPT_EN = () => getPurchaseReceiptSubject('en');

beforeAll(async () => {
    db = await createLiveSchemaDb();
    // Applied to production 2026-09-28 and in the baseline since; the
    // with/without probe is recorded in supabase/migrations/README.md.
    await expectMigrationApplied(db, '20260928_34_purchase_receipt_sent.sql');
    h.admin = pgliteSupabase(db, 'service_role');
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_only';
    await db.query(`INSERT INTO masterclasses (title, stripe_product_id, is_published) VALUES ('Colorimetry', $1, true)`, [PRODUCT.masterclass]);
    await db.query(`INSERT INTO offers (slug, title, stripe_product_id, active) VALUES ('masterclass_pass', 'Masterclass Pass', $1, true)`, [PRODUCT.pass]);
}, 60000);

afterAll(async () => { await db?.close(); });

beforeEach(() => {
    h.sendEmail.mockReset();
    h.sendEmail.mockImplementation(async () => ({ success: true }));
    h.guest = null;
});

describe('a member who pays gets one receipt', () => {
    it('a signed-in purchase gets a receipt naming what she bought', async () => {
        const s = session(await newMember(), [PRODUCT.masterclass]);
        expect(await deliver(s)).toBe(200);

        expect(mailTo(s.customer_details.email)).toEqual([RECEIPT_EN()]);
        const html = (h.sendEmail.mock.calls[0][0] as { html: string }).html;
        expect(html).toContain('Colorimetry');
        expect(html).toContain('150.00');
    });

    it('the rehearsal case: a guest checkout under an email that already signs in', async () => {
        const member = await newMember();
        h.guest = { userId: member, created: false, needsWayIn: false };
        const s = session(null, [PRODUCT.pass]);
        expect(await deliver(s)).toBe(200);

        expect(mailTo(s.customer_details.email)).toEqual([RECEIPT_EN()]);
    });

    it('in her language', async () => {
        const s = session(await newMember({ language: 'es' }), [PRODUCT.masterclass], { locale: 'es' });
        await deliver(s);
        expect(mailTo(s.customer_details.email)).toEqual([getPurchaseReceiptSubject('es')]);
    });

    it('a renewal says it is a renewal', async () => {
        const member = await newMember();
        await db.query(`UPDATE profiles SET has_masterclass_pass = true, access_expires_at = now() + interval '10 days' WHERE id = $1`, [member]);
        const s = session(member, [PRODUCT.pass], { userId: member, kind: 'renewal' });
        await deliver(s);
        expect(mailTo(s.customer_details.email)).toEqual([getPurchaseReceiptSubject('en', { renewal: true })]);
    });
});

describe('once, however the checkout is delivered', () => {
    it('Stripe redelivers the same event', async () => {
        const s = session(await newMember(), [PRODUCT.masterclass]);
        await deliver(s);
        await deliver(s);
        await deliver(s, `evt_other_${s.id}`);
        expect(mailTo(s.customer_details.email)).toHaveLength(1);
    });

    it('two deliveries arrive at once', async () => {
        const s = session(await newMember(), [PRODUCT.masterclass, PRODUCT.pass]);
        await Promise.all([deliver(s), deliver(s, `evt_dup_${s.id}`)]);
        await deliver(s);
        expect(mailTo(s.customer_details.email)).toHaveLength(1);
    });

    it('her checkout return settled every line item before the webhook arrived', async () => {
        const member = await newMember();
        const s = session(member, [PRODUCT.masterclass]);
        h.user = { id: member, email: s.customer_details.email, email_confirmed_at: '2026-01-01T00:00:00Z' };
        h.sessions = [s];
        await syncStripePurchases();
        expect(mailTo(s.customer_details.email), 'the return page sends nothing itself').toHaveLength(0);

        await deliver(s);
        expect(mailTo(s.customer_details.email)).toEqual([RECEIPT_EN()]);
    });

    it('a failed send releases the claim, so a redelivery can still send it', async () => {
        const s = session(await newMember(), [PRODUCT.masterclass]);
        h.sendEmail.mockImplementationOnce(async () => ({ success: false, error: 'Resend refused' }));
        await deliver(s);
        await deliver(s);
        expect(mailTo(s.customer_details.email)).toEqual([RECEIPT_EN(), RECEIPT_EN()]);
        const { rows } = await db.query('SELECT 1 FROM fulfillments WHERE stripe_session_id = $1 AND receipt_sent_at IS NULL', [s.id]);
        expect(rows).toHaveLength(0);
    });
});

describe('a new account gets the welcome instead, never both', () => {
    it('a guest checkout that creates her account: welcome only', async () => {
        const fresh = await newMember();
        h.guest = { userId: fresh, created: true, needsWayIn: true };
        const s = session(null, [PRODUCT.pass]);
        await deliver(s);
        expect(mailTo(s.customer_details.email)).toEqual([getPurchaseWelcomeSubject('en')]);
    });

    it('and a replay after she has set her password does not add a receipt', async () => {
        const fresh = await newMember();
        h.guest = { userId: fresh, created: true, needsWayIn: true };
        const s = session(null, [PRODUCT.pass]);
        await deliver(s);

        // She sets a password: the claim closes and she has now signed in.
        await db.query('UPDATE purchase_claims SET consumed_at = now() WHERE stripe_session_id = $1', [s.id]);
        h.guest = { userId: fresh, created: false, needsWayIn: false };
        await deliver(s, `evt_late_${s.id}`);

        expect(mailTo(s.customer_details.email)).toEqual([getPurchaseWelcomeSubject('en')]);
    });
});
