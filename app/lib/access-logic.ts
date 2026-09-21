
import { SupabaseClient } from '@supabase/supabase-js';

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

/** 23505 = unique_violation: the grant is already recorded, which is success. */
function isDuplicate(error: { code?: string } | null): boolean {
    return error?.code === '23505';
}

/**
 * Set an entitlement flag on the profile, and refuse to pretend it worked.
 *
 * The three call sites previously ignored the result of this update entirely,
 * so a failed write left the buyer with no access while the webhook reported
 * success.
 */
async function setProfileFlag(
    supabase: SupabaseClient,
    userId: string,
    flag: 'has_full_unlock' | 'has_course_pass' | 'has_masterclass_pass'
): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .update({ [flag]: true })
        .eq('id', userId);

    if (error) throw new GrantWriteError(`${flag} for user ${userId}`, error.message);
}

export async function grantAccessForProduct(
    supabase: SupabaseClient,
    userId: string,
    productId: string,
    logFn?: (status: string, msg: string) => Promise<void>
): Promise<boolean> {
    // 1. Masterclass (Specific Check)
    const { data: masterclass, error: mcError } = await supabase
        .from('masterclasses')
        .select('id, title')
        .eq('stripe_product_id', productId)
        .maybeSingle();

    if (logFn) await logFn('info', `Checking Masterclass for ${productId}: Found=${!!masterclass}`);

    if (masterclass) {
        const { error: grantError } = await supabase.from('user_access_grants').insert({
            user_id: userId,
            masterclass_id: masterclass.id,
            grant_type: 'purchase'
        });
        if (grantError && !isDuplicate(grantError)) {
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
        const { error: grantError } = await supabase.from('user_access_grants').insert({
            user_id: userId,
            chapter_id: chapter.id,
            grant_type: 'purchase'
        });
        if (grantError && !isDuplicate(grantError)) {
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
        await setProfileFlag(supabase, userId, 'has_full_unlock');
        await recordOfferGrant(supabase, userId, 'full_access', logFn);
        if (logFn) await logFn('success', 'Granted Full Access (Env Match)');
        return true;
    }

    // 4. Offers (Full Access / Masterclass Pass / Course Pass)
    const { data: offer } = await supabase
        .from('offers')
        .select('slug')
        .eq('stripe_product_id', productId)
        .eq('active', true)
        .maybeSingle();

    if (logFn) await logFn('info', `Checking Offer for ${productId}: Found=${!!offer}, Slug=${offer?.slug}`);

    if (offer) {
        if (offer.slug === 'full_access') {
            await setProfileFlag(supabase, userId, 'has_full_unlock');
            await recordOfferGrant(supabase, userId, offer.slug, logFn);
            if (logFn) await logFn('success', 'Granted Full Access (Offer)');
            return true;
        } else if (offer.slug === 'masterclass_pass') {
            await setProfileFlag(supabase, userId, 'has_masterclass_pass');
            await recordOfferGrant(supabase, userId, offer.slug, logFn);
            if (logFn) await logFn('success', 'Granted Masterclass Pass (Offer)');
            return true;
        } else if (offer.slug === 'course_pass') {
            await setProfileFlag(supabase, userId, 'has_course_pass');
            await recordOfferGrant(supabase, userId, offer.slug, logFn);
            if (logFn) await logFn('success', 'Granted Course Pass (Offer)');
            return true;
        }
    }

    return false;
}
