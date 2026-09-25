
import { SupabaseClient } from '@supabase/supabase-js';
import { nextExpiry } from '@/app/lib/entitlement-period';

/**
 * Record WHICH offer was bought and WHEN.
 *
 * The profile booleans (`has_full_unlock`, `has_course_pass`,
 * `has_masterclass_pass`) are the fast gate
 * and stay exactly as they were. They carry no history though, so once the
 * founding window closes there is otherwise no way to tell a founding member
 * from anyone who bought later — not for pricing, not for perks, not for
 * support. This is that record, and it is unrecoverable if not written at the
 * moment of sale.
 *
 * The unique index from migration 11 makes a replayed webhook a no-op rather
 * than a second founding row, so a conflict here is success, not failure.
 * Amount and currency already live in `purchases`, so they are not duplicated.
 */
async function recordOfferGrant(
    supabase: SupabaseClient,
    userId: string,
    offerSlug: string,
    logFn?: (status: string, msg: string) => Promise<void>
): Promise<void> {
    const { error } = await supabase
        .from('user_access_grants')
        .insert({ user_id: userId, offer_slug: offerSlug, grant_type: 'purchase' });

    if (!error) {
        if (logFn) await logFn('success', `Recorded founding grant: ${offerSlug}`);
        return;
    }

    // 23505 = unique_violation: the row already exists, which is the correct
    // end state for a duplicate delivery.
    if (error.code === '23505') {
        if (logFn) await logFn('info', `Founding grant already recorded: ${offerSlug}`);
        return;
    }

    // Never fail the purchase over the bookkeeping row — access has already
    // been granted by the caller and that is what the buyer paid for.
    console.error('[access-logic] Founding grant insert failed:', error);
    if (logFn) await logFn('error', `Founding grant failed (${offerSlug}): ${error.message}`);
}

/**
 * Thrown when a grant could not be written.
 *
 * The distinction this preserves: `grantAccessForProduct` returning `false`
 * means "this product is not content we grant access to" — a service booking,
 * for example — which is a normal outcome. A write that was supposed to happen
 * and did not is *not* an outcome, it is a failure, and conflating the two is
 * how a buyer ends up charged with nothing to show for it.
 *
 * The Stripe webhook already rolls back its idempotency marker and returns 500
 * from its catch, so throwing here is what makes Stripe retry the delivery.
 * `restorePurchases` catches it and surfaces the error instead of reporting a
 * restore that did not happen.
 */
export class GrantWriteError extends Error {
    constructor(what: string, cause: string) {
        super(`Failed to write ${what}: ${cause}`);
        this.name = 'GrantWriteError';
    }
}

/**
 * How many times a term extension re-reads and retries when another write
 * changed the term between its read and its write. Two is enough for two
 * concurrent renewals; the rest is headroom.
 */
const TERM_WRITE_ATTEMPTS = 5;

/** 23505 = unique_violation: the grant is already recorded, which is success. */
function isDuplicate(error: { code?: string } | null): boolean {
    return error?.code === '23505';
}

/**
 * Set an entitlement flag on the profile, stamp the term, and refuse to pretend
 * it worked.
 *
 * The three call sites previously ignored the result of this update entirely,
 * so a failed write left the buyer with no access while the webhook reported
 * success.
 *
 * The expiry is always computed from what she already holds, so no purchase can
 * ever shorten her access — buying a second pass while the first is live adds a
 * year to the later date rather than resetting to a year from today.
 *
 * Perpetual access is never shortened. A NULL expiry on a profile that already
 * holds a pass is access sold before the term existed (migration 21); the three
 * flags share the one column, so stamping a year on it would put an end date on
 * the access she already owned. She keeps NULL, and the new pass with it.
 *
 * The rung only moves on a renewal. A full-price purchase resets it to zero,
 * which is what makes a lapse cost her the discount: after the grace window she
 * comes back through ordinary checkout, and this is where the ladder restarts.
 */
async function setProfileFlag(
    supabase: SupabaseClient,
    userId: string,
    flag: 'has_full_unlock' | 'has_course_pass' | 'has_masterclass_pass',
    isRenewal: boolean
): Promise<void> {
    // Compare-and-set: the write only lands if the term is still the one it
    // was computed from. Two paid renewals processed at once used to read the
    // same term and both write "term + a year", so one paid year vanished.
    for (let attempt = 0; attempt < TERM_WRITE_ATTEMPTS; attempt++) {
        const { data: held } = await supabase
            .from('profiles')
            .select('access_expires_at, access_renewal_count, has_full_unlock, has_course_pass, has_masterclass_pass')
            .eq('id', userId)
            .maybeSingle();

        const heldExpiry = (held?.access_expires_at as string | null) ?? null;
        const heldCount = (held?.access_renewal_count as number | null) ?? 0;
        const holdsPerpetualPass =
            heldExpiry === null &&
            Boolean(held?.has_full_unlock || held?.has_course_pass || held?.has_masterclass_pass);

        let write = supabase
            .from('profiles')
            .update({
                [flag]: true,
                access_expires_at: holdsPerpetualPass ? null : nextExpiry(heldExpiry),
                access_renewal_count: isRenewal ? heldCount + 1 : 0,
            })
            .eq('id', userId)
            .eq('access_renewal_count', heldCount);
        write = heldExpiry === null ? write.is('access_expires_at', null) : write.eq('access_expires_at', heldExpiry);

        const { data: written, error } = await write.select('id');
        if (error) throw new GrantWriteError(`${flag} for user ${userId}`, error.message);
        if (written && written.length > 0) return;
    }

    throw new GrantWriteError(`${flag} for user ${userId}`, 'the term kept changing under the write');
}

/**
 * Give her a single masterclass or chapter for a year, or extend the one she
 * already has.
 *
 * The duplicate case relies on the unique indexes on (user_id, masterclass_id)
 * and (user_id, chapter_id) from migration 23. Before them the insert never
 * conflicted: a renewal added a second row instead of extending the first.
 *
 * The duplicate case is not a no-op any more. It used to mean "she already owns
 * this, nothing to do", which was true while ownership was perpetual; now it is
 * how a single-item renewal arrives, and treating it as nothing would charge her
 * for a year she never received.
 */
async function grantItemForTerm(
    supabase: SupabaseClient,
    userId: string,
    column: 'masterclass_id' | 'chapter_id',
    itemId: string,
    isRenewal: boolean
): Promise<{ error: { code?: string; message: string } | null }> {
    const { error } = await supabase.from('user_access_grants').insert({
        user_id: userId,
        [column]: itemId,
        grant_type: 'purchase',
        expires_at: nextExpiry(null),
        renewal_count: 0,
    });

    if (!isDuplicate(error)) return { error };

    // Compare-and-set, as in setProfileFlag: two paid renewals landing at once
    // must add two years, not one.
    for (let attempt = 0; attempt < TERM_WRITE_ATTEMPTS; attempt++) {
        const { data: held, error: readError } = await supabase
            .from('user_access_grants')
            .select('expires_at, renewal_count')
            .eq('user_id', userId)
            .eq(column, itemId)
            .maybeSingle();

        if (readError) return { error: readError };
        if (!held) return { error: { message: 'grant vanished between insert and extend' } };

        const heldExpiry = (held.expires_at as string | null) ?? null;
        const heldCount = (held.renewal_count as number | null) ?? 0;

        // A NULL expiry here is perpetual — a pre-term purchase, a bonus or an
        // admin override. Buying the item again must not give it an end date.
        if (heldExpiry === null) return { error: null };

        const { data: written, error: updateError } = await supabase
            .from('user_access_grants')
            .update({
                expires_at: nextExpiry(heldExpiry),
                renewal_count: isRenewal ? heldCount + 1 : 0,
            })
            .eq('user_id', userId)
            .eq(column, itemId)
            .eq('expires_at', heldExpiry)
            .eq('renewal_count', heldCount)
            .select('id');

        if (updateError) return { error: updateError };
        if (written && written.length > 0) return { error: null };
    }

    return { error: { message: 'the term kept changing under the write' } };
}

/**
 * `isRenewal` is last and optional so every existing caller keeps working: a
 * first purchase is the default and the only thing that sets it is the webhook,
 * reading the marker that `createRenewalCheckoutSession` put on the session.
 */
export async function grantAccessForProduct(
    supabase: SupabaseClient,
    userId: string,
    productId: string,
    logFn?: (status: string, msg: string) => Promise<void>,
    isRenewal: boolean = false
): Promise<boolean> {
    // 1. Masterclass (Specific Check)
    const { data: masterclass, error: mcError } = await supabase
        .from('masterclasses')
        .select('id, title')
        .eq('stripe_product_id', productId)
        .maybeSingle();

    if (logFn) await logFn('info', `Checking Masterclass for ${productId}: Found=${!!masterclass}`);

    if (masterclass) {
        const { error: grantError } = await grantItemForTerm(
            supabase,
            userId,
            'masterclass_id',
            masterclass.id,
            isRenewal
        );
        if (grantError) {
            // Previously this logged and returned true, so the webhook answered
            // 200 and Stripe never retried: paid, not granted, no second chance.
            if (logFn) await logFn('error', `Masterclass Grant Failed: ${grantError.message}`);
            throw new GrantWriteError(`masterclass grant for ${masterclass.title}`, grantError.message);
        }
        if (logFn) await logFn('success', `Granted Masterclass: ${masterclass.title}`);
        return true;
    }

    // 2. Chapter (Specific Check)
    const { data: chapter, error: chError } = await supabase
        .from('chapters')
        .select('id, title')
        .eq('stripe_product_id', productId)
        .maybeSingle();

    if (chapter) {
        const { error: grantError } = await grantItemForTerm(
            supabase,
            userId,
            'chapter_id',
            chapter.id,
            isRenewal
        );
        if (grantError) {
            if (logFn) await logFn('error', `Chapter Grant Failed: ${grantError.message}`);
            throw new GrantWriteError(`chapter grant for ${chapter.title}`, grantError.message);
        }
        if (logFn) await logFn('success', `Granted Chapter: ${chapter.title}`);
        return true;
    }

    const FULL_UNLOCK_PRODUCT_ID = process.env.STRIPE_FULL_ACCESS_PRODUCT_ID;

    if (logFn) await logFn('info', `Checking Full Access for ${productId}: Target=${FULL_UNLOCK_PRODUCT_ID ?? 'unset'}, Match=${!!FULL_UNLOCK_PRODUCT_ID && productId === FULL_UNLOCK_PRODUCT_ID}`);

    // 3. Full Unlock (Env)
    //
    // The truthiness check is load-bearing, not defensive noise. With the env
    // var unset this reads `productId === undefined`, so any caller that ever
    // passed a nullish product id would be handed a full unlock. Both current
    // callers guard against that before calling, but the comparison should not
    // depend on them continuing to.
    if (FULL_UNLOCK_PRODUCT_ID && productId === FULL_UNLOCK_PRODUCT_ID) {
        await setProfileFlag(supabase, userId, 'has_full_unlock', isRenewal);
        await recordOfferGrant(supabase, userId, 'full_access', logFn);
        if (logFn) await logFn('success', 'Granted Full Access (Env Match)');
        return true;
    }

    // 4. Offers (Full Access / Masterclass Pass / Course Pass)
    const { data: offer } = await supabase
        .from('offers')
        .select('slug')
        .eq('stripe_product_id', productId)
        // Not filtered on `active`: that decides what is SOLD. A payment
        // already taken for an offer switched off since is still owed.
        .maybeSingle();

    if (logFn) await logFn('info', `Checking Offer for ${productId}: Found=${!!offer}, Slug=${offer?.slug}`);

    if (offer) {
        if (offer.slug === 'full_access') {
            await setProfileFlag(supabase, userId, 'has_full_unlock', isRenewal);
            await recordOfferGrant(supabase, userId, offer.slug, logFn);
            if (logFn) await logFn('success', 'Granted Full Access (Offer)');
            return true;
        } else if (offer.slug === 'masterclass_pass') {
            await setProfileFlag(supabase, userId, 'has_masterclass_pass', isRenewal);
            await recordOfferGrant(supabase, userId, offer.slug, logFn);
            if (logFn) await logFn('success', 'Granted Masterclass Pass (Offer)');
            return true;
        } else if (offer.slug === 'course_pass') {
            await setProfileFlag(supabase, userId, 'has_course_pass', isRenewal);
            await recordOfferGrant(supabase, userId, offer.slug, logFn);
            if (logFn) await logFn('success', 'Granted Course Pass (Offer)');
            return true;
        }
    }

    return false;
}
