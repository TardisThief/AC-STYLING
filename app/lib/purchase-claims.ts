import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single-use credentials that let a guest buyer set her first password.
 *
 * Replaces `user_metadata.pending_password`, which failed as a security marker
 * for two reasons (F06 in the 2026-09-19 assessment):
 *
 *   - It was cleared by `claimPurchase` but **not** by the emailed recovery
 *     link, which goes through `supabase.auth.updateUser({ password })`. A
 *     buyer who used the path we recommend left the Stripe-session window open
 *     for the rest of its 24 hours, so anyone holding that session id could
 *     overwrite her password afterwards.
 *   - `user_metadata` is writable by the user it describes. A field the
 *     subject controls cannot decide a security question about that subject.
 *
 * A row in `purchase_claims` is the credential instead: created server-side,
 * consumed by a single atomic UPDATE, and consumed by *every* path that
 * establishes a password. The table is service-role only (migration 13), so
 * nothing reachable from a browser can read, mint, or extend one.
 *
 * Every function here fails closed. If the table is missing or the query
 * errors, the caller is told the claim is unavailable and the buyer falls back
 * to the emailed recovery link, which always works.
 */

/** How long a claim stays usable. Enforced by the stored `expires_at`. */
export const CLAIM_TTL_SECONDS = 24 * 60 * 60;

export type ConsumedReason = 'claim' | 'password_set';

/**
 * Mint the credential for a freshly created guest account.
 *
 * Idempotent on `stripe_session_id`: a replayed webhook delivery hits the
 * unique index and is a no-op rather than a second live credential.
 */
export async function createPurchaseClaim(
    admin: SupabaseClient,
    { userId, stripeSessionId, email }: { userId: string; stripeSessionId: string; email: string }
): Promise<boolean> {
    const expiresAt = new Date(Date.now() + CLAIM_TTL_SECONDS * 1000).toISOString();

    const { error } = await admin.from('purchase_claims').insert({
        user_id: userId,
        stripe_session_id: stripeSessionId,
        email: email.trim().toLowerCase(),
        expires_at: expiresAt,
    });

    // 23505 = unique_violation: the claim for this session already exists,
    // which is the correct end state for a duplicate delivery.
    if (error && error.code !== '23505') {
        console.error('[purchase-claims] createPurchaseClaim failed:', error);
        return false;
    }

    return true;
}

/**
 * Is there an unspent, unexpired claim for this checkout session?
 *
 * Read-only — used to decide whether the welcome page offers the form at all.
 * Deciding to *act* must go through `consumePurchaseClaim`, never this.
 */
export async function isClaimOpen(
    admin: SupabaseClient,
    stripeSessionId: string
): Promise<boolean> {
    const { data, error } = await admin
        .from('purchase_claims')
        .select('id')
        .eq('stripe_session_id', stripeSessionId)
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (error) {
        console.error('[purchase-claims] isClaimOpen failed:', error);
        return false;
    }

    return !!data;
}

/**
 * Spend the claim for a checkout session, returning the account it authorizes.
 *
 * This is the security boundary, and it is one statement on purpose. The
 * previous design read a flag and then wrote a password as two operations, so
 * two concurrent requests could both pass the check. Here the `UPDATE ...
 * WHERE consumed_at IS NULL ... RETURNING` is the check: exactly one caller
 * gets a row back, everyone else gets nothing, decided by the database.
 *
 * Returns the user id on success, or null if the claim does not exist, has
 * already been spent, or has expired. Never throws for those cases — they are
 * ordinary refusals, not faults.
 */
export async function consumePurchaseClaim(
    admin: SupabaseClient,
    stripeSessionId: string,
    reason: ConsumedReason = 'claim'
): Promise<{ userId: string } | null> {
    const { data, error } = await admin
        .from('purchase_claims')
        .update({ consumed_at: new Date().toISOString(), consumed_reason: reason })
        .eq('stripe_session_id', stripeSessionId)
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .select('user_id')
        .maybeSingle();

    if (error) {
        console.error('[purchase-claims] consumePurchaseClaim failed:', error);
        return null;
    }

    return data ? { userId: data.user_id as string } : null;
}

/**
 * Close every outstanding window for an account.
 *
 * Called whenever a password is established by any route other than the fast
 * lane — the emailed recovery link above all. This is the half that was
 * missing: without it, using the recommended path left the weaker one open.
 *
 * Returns how many were closed, for logging. A failure here is reported but
 * never blocks the password change itself; refusing to let someone set a
 * password because bookkeeping failed would be the worse outcome, and the
 * claim still expires on its own.
 */
export async function consumeClaimsForUser(
    admin: SupabaseClient,
    userId: string
): Promise<number> {
    const { data, error } = await admin
        .from('purchase_claims')
        .update({ consumed_at: new Date().toISOString(), consumed_reason: 'password_set' })
        .eq('user_id', userId)
        .is('consumed_at', null)
        .select('id');

    if (error) {
        console.error('[purchase-claims] consumeClaimsForUser failed:', error);
        return 0;
    }

    return data?.length ?? 0;
}
