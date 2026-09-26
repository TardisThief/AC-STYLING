/**
 * Is anyone paid-but-not-granted? Read-only; exits non-zero if so.
 *
 *   node scripts/ops/check_fulfillments.mjs
 *
 * The 2026-09-25 external assessment (OPS-001): for "a customer pays at 11 PM
 * and cannot get in", the data existed — `fulfillments` records every paid
 * line item and why it failed — but nobody was told. Discovery waited on the
 * customer writing in. Some failure paths answer Stripe 200, so Stripe's own
 * retry alerts never fire either.
 *
 * Two checks:
 *
 *   1. Database: a line item left 'failed', or 'processing' for longer than
 *      any run can last (a run that died). Either one is money taken and,
 *      until someone acts or Stripe's retry lands, access not granted.
 *   2. Stripe, when STRIPE_SECRET_KEY is set: paid checkout sessions from the
 *      last few days with a line item that has no finished fulfilment row at
 *      all — the webhook never arrived, or failed before it recorded anything.
 *
 * Designed for the owner's `hermes` cron, beside the nightly backup (see
 * docs/HERMES-BACKUP-SETUP.md), because that host already turns a missed or
 * failed healthcheck ping into an email. Set FULFILLMENT_HEALTHCHECK_URL to a
 * dedicated healthchecks.io check: this pings it on a clean run and pings
 * `<url>/fail` with the report otherwise.
 *
 * It never writes to the database. Repair goes through the admin console or
 * a Stripe redelivery, by a person who has read the report.
 */
import { pathToFileURL } from 'node:url';

/** Older than this, a 'processing' row was left by a run that died (fulfillment.ts uses 15). */
export const STUCK_AFTER_MINUTES = 30;
/** A session younger than this may simply be mid-webhook. */
export const SETTLE_MINUTES = 30;
/** How far back the Stripe check looks. */
export const LOOKBACK_DAYS = 3;

/**
 * Line items the database already knows are not granted.
 * `db.query(sql, params)` must resolve to `{ rows }` (pg and PGlite both do).
 */
export async function findStuckFulfillments(db, now = new Date()) {
    const { rows } = await db.query(
        `SELECT stripe_line_item_id, stripe_session_id, user_id, stripe_product_id, status,
                attempts, last_error, updated_at
           FROM public.fulfillments
          WHERE status = 'failed'
             OR (status = 'processing' AND updated_at < $1::timestamptz - make_interval(mins => $2))
          ORDER BY updated_at`,
        [now.toISOString(), STUCK_AFTER_MINUTES]
    );
    return rows;
}

/**
 * Paid line items with no finished fulfilment row. `stripe` is the Stripe SDK
 * client; only `checkout.sessions.list` and `listLineItems` are used.
 */
export async function findUnrecordedPayments(stripe, db, now = new Date()) {
    const since = Math.floor(now.getTime() / 1000) - LOOKBACK_DAYS * 24 * 60 * 60;
    const settled = Math.floor(now.getTime() / 1000) - SETTLE_MINUTES * 60;
    const missing = [];

    let startingAfter;
    for (let page = 0; page < 50; page++) {
        const { data, has_more } = await stripe.checkout.sessions.list({
            created: { gte: since },
            status: 'complete',
            limit: 100,
            ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const session of data) {
            if (session.payment_status !== 'paid' || session.created > settled) continue;
            const { data: items } = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
            const ids = items.map(i => i.id);
            if (ids.length === 0) continue;
            const { rows } = await db.query(
                `SELECT stripe_line_item_id FROM public.fulfillments
                  WHERE stripe_line_item_id = ANY($1::text[]) AND status IN ('completed', 'unfulfillable')`,
                [ids]
            );
            const done = new Set(rows.map(r => r.stripe_line_item_id));
            for (const item of items) {
                if (!done.has(item.id)) {
                    missing.push({
                        stripe_session_id: session.id,
                        stripe_line_item_id: item.id,
                        email: session.customer_details?.email ?? session.customer_email ?? null,
                        created: new Date(session.created * 1000).toISOString(),
                    });
                }
            }
        }
        if (!has_more || data.length === 0) break;
        startingAfter = data[data.length - 1].id;
    }
    return missing;
}

export function formatReport(stuck, missing) {
    const lines = [];
    for (const f of stuck) {
        lines.push(`STUCK ${f.status} ${f.stripe_line_item_id} session=${f.stripe_session_id} user=${f.user_id} product=${f.stripe_product_id} attempts=${f.attempts} since=${new Date(f.updated_at).toISOString()} error=${(f.last_error ?? '').slice(0, 200)}`);
    }
    for (const m of missing) {
        lines.push(`UNRECORDED ${m.stripe_line_item_id} session=${m.stripe_session_id} paid=${m.created} email=${m.email ?? 'unknown'}`);
    }
    return lines.join('\n');
}

async function ping(url, suffix, body) {
    if (!url) return;
    try {
        await fetch(url + suffix, { method: 'POST', body, signal: AbortSignal.timeout(10000) });
    } catch (e) {
        console.error('[check_fulfillments] healthcheck ping failed:', e.message);
    }
}

async function main() {
    const { default: dotenv } = await import('dotenv');
    dotenv.config({ path: '.env.local', quiet: true });
    const { default: pg } = await import('pg');
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const hc = process.env.FULFILLMENT_HEALTHCHECK_URL;
    try {
        await db.query('BEGIN READ ONLY');
        const stuck = await findStuckFulfillments(db);
        let missing = [];
        if (process.env.STRIPE_SECRET_KEY) {
            const { default: Stripe } = await import('stripe');
            missing = await findUnrecordedPayments(new Stripe(process.env.STRIPE_SECRET_KEY), db);
        } else {
            console.warn('[check_fulfillments] STRIPE_SECRET_KEY not set: database check only.');
        }
        await db.query('ROLLBACK');

        const report = formatReport(stuck, missing);
        if (report) {
            console.log(report);
            console.log(`\n${stuck.length} stuck, ${missing.length} unrecorded. Paid and not granted: act on each.`);
            await ping(hc, '/fail', report);
            process.exitCode = 1;
        } else {
            console.log('OK: every paid line item is granted or deliberately unfulfillable.');
            await ping(hc, '', 'ok');
        }
    } catch (e) {
        await ping(hc, '/fail', `check_fulfillments crashed: ${e.message}`);
        throw e;
    } finally {
        await db.end();
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    main().catch(e => {
        console.error(e);
        process.exit(2);
    });
}
