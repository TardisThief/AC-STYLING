// @vitest-environment node
/**
 * The paid-but-not-granted alert (OPS-001), against the live schema.
 *
 * scripts/ops/check_fulfillments.mjs is what tells a human; if it misses a
 * state, nobody is told. These run its two checks over PGlite with the real
 * `fulfillments` table, and a Stripe stand-in shaped like the SDK's list.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { findStuckFulfillments, findUnrecordedPayments, formatReport } from '../../scripts/ops/check_fulfillments.mjs';

const BUYER = '00000000-0000-4000-8000-00000000d001';
const NOW = new Date('2026-09-26T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60000).toISOString();

let db: PGlite;

async function row(li: string, status: string, updatedMinutesAgo: number) {
    await db.query(
        `INSERT INTO fulfillments (stripe_line_item_id, stripe_session_id, stripe_event_id, user_id, stripe_product_id, status, attempts, updated_at)
         VALUES ($1, $2, 'evt', $3, 'prod_x', $4, 1, $5)`,
        [li, `cs_${li}`, BUYER, status, minutesAgo(updatedMinutesAgo)]);
}

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await createUser(db, BUYER);
    await row('li_failed', 'failed', 5);
    await row('li_died', 'processing', 60);
    await row('li_running', 'processing', 2);
    await row('li_done', 'completed', 60);
    await row('li_service', 'unfulfillable', 60);
}, 60000);

afterAll(async () => { await db?.close(); });

describe('findStuckFulfillments', () => {
    it('reports a failed line item and one a dead run left processing, and nothing else', async () => {
        const stuck = await findStuckFulfillments(db, NOW);

        expect(stuck.map((r: { stripe_line_item_id: string }) => r.stripe_line_item_id).sort()).toEqual(['li_died', 'li_failed']);
    });
});

describe('findUnrecordedPayments', () => {
    const paidAgo = (m: number) => Math.floor((NOW.getTime() - m * 60000) / 1000);
    const sessions = [
        { id: 'cs_webhook_never_came', payment_status: 'paid', created: paidAgo(90), customer_details: { email: 'lost@example.invalid' } },
        { id: 'cs_all_good', payment_status: 'paid', created: paidAgo(90), customer_details: { email: 'ok@example.invalid' } },
        { id: 'cs_just_paid', payment_status: 'paid', created: paidAgo(5), customer_details: { email: 'new@example.invalid' } },
        { id: 'cs_unpaid', payment_status: 'unpaid', created: paidAgo(90), customer_details: { email: 'x@example.invalid' } },
    ];
    const items: Record<string, { id: string }[]> = {
        cs_webhook_never_came: [{ id: 'li_never_recorded' }],
        cs_all_good: [{ id: 'li_done' }, { id: 'li_service' }],
        cs_just_paid: [{ id: 'li_in_flight' }],
        cs_unpaid: [{ id: 'li_unpaid' }],
    };
    const stripe = {
        checkout: {
            sessions: {
                list: async () => ({ data: sessions, has_more: false }),
                listLineItems: async (id: string) => ({ data: items[id] ?? [] }),
            },
        },
    };

    it('reports a paid line item with no finished fulfilment, but not one still settling or unpaid', async () => {
        const missing = await findUnrecordedPayments(stripe, db, NOW);

        expect(missing).toEqual([expect.objectContaining({ stripe_line_item_id: 'li_never_recorded', email: 'lost@example.invalid' })]);
    });

    it('produces a report a person can act on', async () => {
        const report = formatReport(await findStuckFulfillments(db, NOW), await findUnrecordedPayments(stripe, db, NOW));

        expect(report).toContain('STUCK failed li_failed');
        expect(report).toContain('STUCK processing li_died');
        expect(report).toContain('UNRECORDED li_never_recorded');
    });
});
