// @vitest-environment node
/**
 * Closing paid line items that lost their fulfilment record, against the live
 * schema (scripts/ops/close_orphaned_sessions.mjs).
 *
 * Before migration 32, deleting an account deleted its fulfilment rows, so its
 * paid guest sessions could be Restored by the next person with that email.
 * The script writes a detached, completed marker for each; these check it
 * finds exactly those, and that Restore's claim then treats them as settled.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';
import { claimLineItem } from '@/app/lib/fulfillment';
import { closeOrphans, findOrphans } from '../../scripts/ops/close_orphaned_sessions.mjs';

const OWNER = '00000000-0000-4000-8000-0000000c0001';
const NOW = new Date('2026-09-26T18:00:00Z');
const ago = (minutes: number) => Math.floor((NOW.getTime() - minutes * 60000) / 1000);

let db: PGlite;

const sessions = [
    { id: 'cs_wiped', payment_status: 'paid', created: ago(60 * 24 * 6), customer_details: { email: 'old@example.invalid' } },
    { id: 'cs_settled', payment_status: 'paid', created: ago(60 * 24), customer_details: { email: 'live@example.invalid' } },
    { id: 'cs_in_flight', payment_status: 'paid', created: ago(10), customer_details: { email: 'new@example.invalid' } },
    { id: 'cs_unpaid', payment_status: 'unpaid', created: ago(60 * 24), customer_details: { email: 'x@example.invalid' } },
];
const items: Record<string, { id: string; price: { product: string }; amount_total: number; currency: string }[]> = {
    cs_wiped: [{ id: 'li_wiped', price: { product: 'prod_full' }, amount_total: 15000, currency: 'usd' }],
    cs_settled: [{ id: 'li_settled', price: { product: 'prod_mc' }, amount_total: 5000, currency: 'usd' }],
    cs_in_flight: [{ id: 'li_in_flight', price: { product: 'prod_mc' }, amount_total: 5000, currency: 'usd' }],
    cs_unpaid: [{ id: 'li_unpaid', price: { product: 'prod_mc' }, amount_total: 5000, currency: 'usd' }],
};
const stripe = {
    checkout: {
        sessions: {
            list: async () => ({ data: sessions, has_more: false }),
            listLineItems: async (id: string) => ({ data: items[id] ?? [] }),
        },
    },
};

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await createUser(db, OWNER);
    await db.query(
        `INSERT INTO fulfillments (stripe_line_item_id, stripe_session_id, stripe_event_id, user_id, stripe_product_id, status)
         VALUES ('li_settled', 'cs_settled', 'evt', $1, 'prod_mc', 'completed')`, [OWNER]);
}, 60000);

afterAll(async () => { await db?.close(); });

describe('close_orphaned_sessions', () => {
    it('finds only paid, settled-in-time line items with no fulfilment record', async () => {
        const orphans = await findOrphans(stripe, db, NOW);

        expect(orphans.map((o: { lineItemId: string }) => o.lineItemId)).toEqual(['li_wiped']);
    });

    it('closes them so a Restore claim finds them settled, and is idempotent', async () => {
        const orphans = await findOrphans(stripe, db, NOW);
        expect(await closeOrphans(db, orphans, 'test')).toBe(1);
        expect(await closeOrphans(db, orphans, 'test')).toBe(0);

        const claim = await claimLineItem(pgliteSupabase(db), {
            lineItemId: 'li_wiped', sessionId: 'cs_wiped', eventId: 'restore:cs_wiped',
            userId: OWNER, productId: 'prod_full',
        });
        expect(claim).toEqual({ state: 'already_completed' });
        expect(await findOrphans(stripe, db, NOW)).toEqual([]);
    });
});
