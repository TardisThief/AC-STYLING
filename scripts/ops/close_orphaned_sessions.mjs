/**
 * Mark every paid Stripe line item that has no fulfilment record as closed,
 * so Restore can never grant it.
 *
 *   node scripts/ops/close_orphaned_sessions.mjs            # dry run: report only
 *   node scripts/ops/close_orphaned_sessions.mjs --apply    # write the markers
 *
 * Why (found by the owner 2026-09-26): a guest purchase belongs to its email,
 * and until migration 32 deleting an account deleted its fulfilment rows — the
 * only record that its line items were settled. Every account deleted before
 * then (the 2026-09-26 wipe included) left paid guest sessions in Stripe that
 * the next person to sign up with that address could Restore, free. Stripe
 * sessions cannot be deleted; the marker is what closes them.
 *
 * A marker is a fulfilments row: status 'completed', user_id NULL (no account
 * owns it), stripe_event_id 'closed:<session>', and a last_error saying why.
 * claimLineItem treats a detached row as settled, so nothing re-grants it.
 *
 * Only line items with NO fulfilment row are touched; a session younger than
 * an hour is skipped, since its webhook may still be in flight. Refuses a
 * live-mode key unless --live is passed: in live mode the same orphans can only
 * come from accounts deleted before migration 32, and closing them is a
 * decision about real customers.
 */
import { pathToFileURL } from 'node:url';

export const MIN_AGE_SECONDS = 60 * 60;

/**
 * Line items of paid, complete sessions older than MIN_AGE_SECONDS with no
 * fulfilment row. `stripe`: checkout.sessions.list/listLineItems; `db`: query.
 */
export async function findOrphans(stripe, db, now = new Date()) {
    const cutoff = Math.floor(now.getTime() / 1000) - MIN_AGE_SECONDS;
    const orphans = [];
    let startingAfter;
    for (let page = 0; page < 200; page++) {
        const { data, has_more } = await stripe.checkout.sessions.list({
            status: 'complete',
            limit: 100,
            ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const session of data) {
            if (session.payment_status !== 'paid' || session.created > cutoff) continue;
            const { data: items } = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
            if (items.length === 0) continue;
            const { rows } = await db.query(
                'SELECT stripe_line_item_id FROM public.fulfillments WHERE stripe_line_item_id = ANY($1::text[])',
                [items.map(i => i.id)]
            );
            const known = new Set(rows.map(r => r.stripe_line_item_id));
            for (const item of items) {
                if (known.has(item.id)) continue;
                const product = typeof item.price?.product === 'string' ? item.price.product : item.price?.product?.id;
                orphans.push({
                    lineItemId: item.id,
                    sessionId: session.id,
                    productId: product ?? 'unknown',
                    amountTotal: item.amount_total ?? null,
                    currency: item.currency ?? null,
                    email: session.customer_details?.email ?? session.customer_email ?? null,
                    created: new Date(session.created * 1000).toISOString(),
                });
            }
        }
        if (!has_more || data.length === 0) break;
        startingAfter = data[data.length - 1].id;
    }
    return orphans;
}

/** Write one closed marker per orphan. Idempotent: an existing row is left alone. */
export async function closeOrphans(db, orphans, reason) {
    let closed = 0;
    for (const o of orphans) {
        const { rows } = await db.query(
            `INSERT INTO public.fulfillments
                (stripe_line_item_id, stripe_session_id, stripe_event_id, user_id, stripe_product_id,
                 amount_total, currency, status, attempts, completed_at, updated_at, last_error)
             VALUES ($1, $2, $3, NULL, $4, $5, $6, 'completed', 0, now(), now(), $7)
             ON CONFLICT (stripe_line_item_id) DO NOTHING
             RETURNING stripe_line_item_id`,
            [o.lineItemId, o.sessionId, `closed:${o.sessionId}`, o.productId, o.amountTotal, o.currency, reason]
        );
        closed += rows.length;
    }
    return closed;
}

async function main() {
    const APPLY = process.argv.includes('--apply');
    const LIVE = process.argv.includes('--live');
    const { default: dotenv } = await import('dotenv');
    dotenv.config({ path: '.env.local', quiet: true });
    const key = process.env.STRIPE_SECRET_KEY ?? '';
    if (!key) throw new Error('STRIPE_SECRET_KEY is required');
    if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_') && !LIVE) {
        throw new Error('This is a live-mode key. Closing real customers\' purchases needs --live, on purpose.');
    }
    const { default: Stripe } = await import('stripe');
    const { default: pg } = await import('pg');
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
        const orphans = await findOrphans(new Stripe(key), db);
        for (const o of orphans) {
            console.log(`${APPLY ? 'CLOSE' : 'WOULD CLOSE'} ${o.lineItemId} ${o.productId} ${o.amountTotal ?? '?'} ${o.currency ?? ''} paid ${o.created} by ${o.email ?? 'unknown'}`);
        }
        if (!APPLY) {
            console.log(`Dry run: ${orphans.length} orphaned line item(s). Re-run with --apply.`);
            return;
        }
        const reason = `closed ${new Date().toISOString().slice(0, 10)}: paid line item with no fulfilment record (its account was deleted before migration 32)`;
        await db.query('BEGIN');
        const closed = await closeOrphans(db, orphans, reason);
        await db.query('COMMIT');
        console.log(`Closed ${closed} of ${orphans.length}.`);
    } catch (e) {
        await db.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        await db.end();
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    main().catch(e => { console.error(e.message ?? e); process.exit(1); });
}
