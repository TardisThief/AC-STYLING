
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Record WHICH offer was bought and WHEN.
 *
 * The profile booleans (`has_full_unlock`, `has_course_pass`) are the fast gate
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
        if (grantError) {
            if (logFn) await logFn('error', `Masterclass Grant Failed: ${grantError.message}`);
        } else {
            if (logFn) await logFn('success', `Granted Masterclass: ${masterclass.title}`);
        }
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
        if (grantError) {
            if (logFn) await logFn('error', `Chapter Grant Failed: ${grantError.message}`);
        } else {
            if (logFn) await logFn('success', `Granted Chapter: ${chapter.title}`);
        }
        return true;
    }

    const FULL_UNLOCK_PRODUCT_ID = process.env.STRIPE_FULL_ACCESS_PRODUCT_ID;

    if (logFn) await logFn('info', `Checking Full Access for ${productId}: Target=${FULL_UNLOCK_PRODUCT_ID}, Match=${productId === FULL_UNLOCK_PRODUCT_ID}`);

    // 3. Full Unlock (Env)
    if (productId === FULL_UNLOCK_PRODUCT_ID) {
        await supabase.from('profiles').update({ has_full_unlock: true }).eq('id', userId);
        await recordOfferGrant(supabase, userId, 'full_access', logFn);
        if (logFn) await logFn('success', 'Granted Full Access (Env Match)');
        return true;
    }

    // 4. Offers (Full Pass / Course Pass)
    const { data: offer } = await supabase
        .from('offers')
        .select('slug')
        .eq('stripe_product_id', productId)
        .eq('active', true)
        .maybeSingle();

    if (logFn) await logFn('info', `Checking Offer for ${productId}: Found=${!!offer}, Slug=${offer?.slug}`);

    if (offer) {
        if (offer.slug === 'full_access') {
            await supabase.from('profiles').update({ has_full_unlock: true }).eq('id', userId);
            await recordOfferGrant(supabase, userId, offer.slug, logFn);
            if (logFn) await logFn('success', 'Granted Full Access (Offer)');
            return true;
        } else if (offer.slug === 'course_pass') {
            await supabase.from('profiles').update({ has_course_pass: true }).eq('id', userId);
            await recordOfferGrant(supabase, userId, offer.slug, logFn);
            if (logFn) await logFn('success', 'Granted Course Pass (Offer)');
            return true;
        }
    }

    return false;
}
