import type { SupabaseClient } from '@supabase/supabase-js';
import { grantAccessForProduct } from '@/app/lib/access-logic';

/**
 * Durable, per-line-item fulfillment state (F05).
 *
 * Before this, the only record that a payment had been dealt with was a row in
 * `stripe_processed_events` saying the *event* had been seen. That is not the
 * same claim. It was written before the work started and removed only if the
 * handler threw, so an abrupt termination — a function timeout, an instance
 * recycled mid-run — left the event permanently "processed" with the work half
 * done and no retry possible. And because it was per-event rather than
 * per-item, a failure on the third line item meant redoing the first two,
 * which duplicated their `purchases` rows.
 *
 * A row here is the unit of work: one Stripe line item, unique on its id, with
 * a status that distinguishes "finished" from "started and never came back".
 *
 * It is also the ONLY thing standing between a purchase and a second grant.
 * Since the one-year term (migration 21) a grant is not idempotent — each one
 * extends the term by a year — so every path that grants a paid line item goes
 * through `fulfillLineItem` below, and exactly one caller may own a row.
 */

export type FulfillmentStatus = 'processing' | 'completed' | 'failed' | 'unfulfillable';

export interface LineItemRef {
    lineItemId: string;
    sessionId: string;
    eventId: string;
    userId: string;
    productId: string;
    amountTotal?: number | null;
    currency?: string | null;
}

export type ClaimOutcome =
    /** This caller owns the work; go and do it. */
    | { state: 'claimed' }
    /** A previous delivery finished it. Skip, and do not treat as an error. */
    | { state: 'already_completed' }
    /** Terminal by decision, not by failure — nothing to grant for this product. */
    | { state: 'already_unfulfillable' }
    /**
     * Another delivery (or the buyer's checkout return) owns it right now. Do
     * not grant: the owner will. The webhook answers 500 so Stripe comes back.
     */
    | { state: 'in_progress' }
    /** The bookkeeping itself failed; the caller must not proceed silently. */
    | { state: 'error'; message: string };

/**
 * How long a `processing` row belongs to whoever wrote it.
 *
 * Longer than any serverless run can last, so a row this old was left by a run
 * that died. Younger than that it is someone else's work in flight, and
 * re-claiming it would grant the same purchase twice.
 */
export const STALE_CLAIM_MS = 15 * 60 * 1000;

/**
 * Take ownership of a line item, or report that it is already done or owned.
 *
 * Exactly one caller can win. The webhook and the buyer's checkout return
 * routinely arrive within seconds of each other, so ownership is taken with a
 * single conditional write — insert-if-absent for a new row, compare-and-set
 * on `attempts` for a failed or abandoned one — and a caller whose write
 * changed nothing does not own it.
 *
 * A row left `processing` by a crashed run is re-claimable once it is older
 * than STALE_CLAIM_MS. The alternative — treating it as owned for ever — turns
 * a crash into a permanently stuck purchase.
 */
export async function claimLineItem(
    admin: SupabaseClient,
    ref: LineItemRef,
    now: number = Date.now()
): Promise<ClaimOutcome> {
    const { data: existing, error: readError } = await admin
        .from('fulfillments')
        .select('status, attempts, updated_at')
        .eq('stripe_line_item_id', ref.lineItemId)
        .maybeSingle();

    if (readError) {
        return { state: 'error', message: readError.message };
    }

    if (existing?.status === 'completed') return { state: 'already_completed' };
    if (existing?.status === 'unfulfillable') return { state: 'already_unfulfillable' };

    const row = {
        stripe_line_item_id: ref.lineItemId,
        stripe_session_id: ref.sessionId,
        stripe_event_id: ref.eventId,
        user_id: ref.userId,
        stripe_product_id: ref.productId,
        amount_total: ref.amountTotal ?? null,
        currency: ref.currency ?? null,
        status: 'processing' as const,
        attempts: (existing?.attempts ?? 0) + 1,
        updated_at: new Date(now).toISOString(),
    };

    if (!existing) {
        // Insert-if-absent. An empty result means another caller inserted it
        // between our read and this write: theirs, not ours.
        const { data: inserted, error: insertError } = await admin
            .from('fulfillments')
            .upsert(row, { onConflict: 'stripe_line_item_id', ignoreDuplicates: true })
            .select('stripe_line_item_id');

        if (insertError) return { state: 'error', message: insertError.message };
        return inserted && inserted.length > 0 ? { state: 'claimed' } : { state: 'in_progress' };
    }

    if (existing.status === 'processing') {
        const touched = new Date(existing.updated_at as string).getTime();
        if (Number.isFinite(touched) && now - touched < STALE_CLAIM_MS) return { state: 'in_progress' };
    }

    // Failed, or abandoned mid-run: take it over only if nobody else has since.
    // `attempts` is the version number.
    const { data: taken, error: takeError } = await admin
        .from('fulfillments')
        .update(row)
        .eq('stripe_line_item_id', ref.lineItemId)
        .eq('attempts', existing.attempts ?? 0)
        .select('stripe_line_item_id');

    if (takeError) return { state: 'error', message: takeError.message };
    return taken && taken.length > 0 ? { state: 'claimed' } : { state: 'in_progress' };
}

/**
 * Mark the work finished.
 *
 * Called only after the grant has actually committed. Marking completion
 * before that is precisely the bug F05 describes: the system reporting success
 * it had not achieved.
 */
export async function markCompleted(
    admin: SupabaseClient,
    lineItemId: string,
    { attempts = 3, backoffMs = 200 }: { attempts?: number; backoffMs?: number } = {}
): Promise<void> {
    // Retried, because failing here is not harmless: the grant has landed, the
    // row stays `processing`, and once it is older than STALE_CLAIM_MS a retry
    // re-claims it and grants the year again. Throwing would be worse — the
    // caller would mark it failed, which is re-claimable at once. What is left
    // after the retries (the database refusing several writes in a row, right
    // after accepting the grant) is logged loudly for a human.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
        const now = new Date().toISOString();
        const { error } = await admin
            .from('fulfillments')
            .update({ status: 'completed', completed_at: now, updated_at: now, last_error: null })
            .eq('stripe_line_item_id', lineItemId);
        if (!error) return;
        lastError = error;
    }
    console.error(`[fulfillment] markCompleted failed ${attempts} times; line item ${lineItemId} is granted but still 'processing':`, lastError);
}

/** Record why a line item failed, so a retry has context and support has an answer. */
export async function markFailed(
    admin: SupabaseClient,
    lineItemId: string,
    reason: string
): Promise<void> {
    const { error } = await admin
        .from('fulfillments')
        .update({
            status: 'failed',
            last_error: reason.slice(0, 2000),
            updated_at: new Date().toISOString(),
        })
        .eq('stripe_line_item_id', lineItemId);

    if (error) console.error('[fulfillment] markFailed failed:', error);
}

/**
 * Terminal, and not an error: the payment is real but the product maps to no
 * content we grant — a service booking, for instance. Retrying forever would
 * be wrong, so this is recorded as a decision rather than a failure.
 */
export async function markUnfulfillable(
    admin: SupabaseClient,
    lineItemId: string,
    reason: string
): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await admin
        .from('fulfillments')
        .update({
            status: 'unfulfillable',
            last_error: reason.slice(0, 2000),
            completed_at: now,
            updated_at: now,
        })
        .eq('stripe_line_item_id', lineItemId);

    if (error) console.error('[fulfillment] markUnfulfillable failed:', error);
}

export type FulfillOutcome = 'granted' | 'unfulfillable' | 'already_settled' | 'in_progress';

/**
 * Fulfil one paid line item: claim it, record the purchase, grant, settle.
 *
 * The single path for both the Stripe webhook and the buyer's own checkout
 * return / Restore button (syncStripePurchases). They used to be two paths,
 * and only the webhook consulted `fulfillments` — so every checkout return
 * granted the purchase a second time.
 *
 * Throws, after recording why, when a write that had to happen did not, so
 * the webhook answers 500 and Stripe retries.
 */
export async function fulfillLineItem(
    admin: SupabaseClient,
    ref: LineItemRef,
    { isRenewal = false, logFn }: {
        isRenewal?: boolean;
        logFn?: (status: string, msg: string) => Promise<void>;
    } = {}
): Promise<FulfillOutcome> {
    const claim = await claimLineItem(admin, ref);

    if (claim.state === 'already_completed' || claim.state === 'already_unfulfillable') {
        return 'already_settled';
    }
    if (claim.state === 'in_progress') return 'in_progress';
    if (claim.state === 'error') {
        // The record of what we are about to do could not be written, so
        // doing it would be untracked work.
        throw new Error(`Could not claim line item ${ref.lineItemId}: ${claim.message}`);
    }

    try {
        // Unique on the line item since migration 14, so a conflict means
        // "already recorded", which is success.
        const { error: purchaseError } = await admin.from('purchases').insert({
            user_id: ref.userId,
            product_id: ref.productId,
            stripe_line_item_id: ref.lineItemId,
            amount_paid: ref.amountTotal ? ref.amountTotal / 100 : 0,
            currency: ref.currency?.toUpperCase() || 'USD',
            status: 'completed',
            // What prices her next renewal is the most recent row where this
            // is false, so a renewal is never priced off another renewal.
            is_renewal: isRenewal,
        });

        if (purchaseError && purchaseError.code !== '23505') {
            // This used to be logged and stepped over, so the money was taken
            // with no record of the sale.
            throw new Error(`Purchase insert failed: ${purchaseError.message}`);
        }

        // Throws on a write that had to happen and did not; returns false when
        // the product is simply not content we grant.
        const granted = await grantAccessForProduct(admin, ref.userId, ref.productId, logFn, isRenewal, ref.lineItemId);

        if (granted) {
            // Only now, with the grant committed.
            await markCompleted(admin, ref.lineItemId);
            return 'granted';
        }

        // A real payment for something with nothing to unlock — a service
        // booking. Terminal on purpose: retrying it forever would never succeed.
        if (logFn) await logFn('warning', `No content match for Product ID: ${ref.productId}`);
        await markUnfulfillable(admin, ref.lineItemId, `No content matches product ${ref.productId}`);
        return 'unfulfillable';
    } catch (itemError) {
        const message = itemError instanceof Error ? itemError.message : String(itemError);
        await markFailed(admin, ref.lineItemId, message);
        if (logFn) await logFn('error', `Fulfillment failed for line item ${ref.lineItemId}: ${message}`);
        throw itemError;
    }
}
