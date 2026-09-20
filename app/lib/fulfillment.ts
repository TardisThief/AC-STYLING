import type { SupabaseClient } from '@supabase/supabase-js';

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
    /** This delivery owns the work; go and do it. */
    | { state: 'claimed' }
    /** A previous delivery finished it. Skip, and do not treat as an error. */
    | { state: 'already_completed' }
    /** Terminal by decision, not by failure — nothing to grant for this product. */
    | { state: 'already_unfulfillable' }
    /** The bookkeeping itself failed; the caller must not proceed silently. */
    | { state: 'error'; message: string };

/**
 * Take ownership of a line item, or report that it is already done.
 *
 * The upsert is the idempotency boundary: the unique index on
 * `stripe_line_item_id` means a replayed delivery re-finds the existing row
 * instead of creating a second one, and its status then decides what happens.
 *
 * A row left in `processing` by a crashed run is deliberately re-claimable.
 * The alternative — treating it as owned by whoever wrote it — turns a crash
 * into a permanently stuck purchase, which is the failure this whole change
 * exists to remove. The work it guards is idempotent on its own (grants use
 * unique constraints, purchases are unique per line item), so re-running it is
 * safe.
 */
export async function claimLineItem(
    admin: SupabaseClient,
    ref: LineItemRef
): Promise<ClaimOutcome> {
    const { data: existing, error: readError } = await admin
        .from('fulfillments')
        .select('status, attempts')
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
        updated_at: new Date().toISOString(),
    };

    const { error: writeError } = await admin
        .from('fulfillments')
        .upsert(row, { onConflict: 'stripe_line_item_id' });

    if (writeError) {
        return { state: 'error', message: writeError.message };
    }

    return { state: 'claimed' };
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
    lineItemId: string
): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await admin
        .from('fulfillments')
        .update({ status: 'completed', completed_at: now, updated_at: now, last_error: null })
        .eq('stripe_line_item_id', lineItemId);

    // Worth being loud about: the buyer has access but the record says
    // otherwise, so a retry will redo work that is already done. Harmless —
    // every step is idempotent — but it is a real inconsistency.
    if (error) {
        console.error('[fulfillment] markCompleted failed:', error);
    }
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
