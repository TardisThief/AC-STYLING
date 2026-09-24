'use server';

import type Stripe from 'stripe';
import { stripe } from '@/utils/stripe';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { graceEnds, renewalAmountCents, withinGrace } from '@/app/lib/entitlement-period';

export async function createCheckoutSession(priceId: string, returnUrl: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.is_anonymous) {
        return { error: 'User must be logged in' };
    }

    if (!priceId) {
        return { error: 'Price ID is missing' };
    }

    const headersList = await headers();
    const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const email = user.email;

    // Fallback: If user.email is missing, try fetching from profiles or metadata?
    // Supabase Auth usually guarantees email unless anonymous.
    // However, we should be robust.
    if (!email) {
        // Try to get from profile if relevant, but profile usually doesn't store email to avoid sync issues.
        // We will pass undefined to customer_email if missing, BUT stripe requires it for most payment methods or sending receipts.
        // Actually, customer_email is optional but recommended.
        // BUT, if it is an empty string or invalid, it errors.
        console.warn("User has no email in Auth session", user.id);
    }

    try {
        const sessionPayload: Stripe.Checkout.SessionCreateParams = {
            mode: 'payment',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${origin}${returnUrl}?checkout_success=true`,
            cancel_url: `${origin}${returnUrl}`,
            client_reference_id: user.id,
            metadata: {
                userId: user.id,
            },
            phone_number_collection: {
                enabled: true,
            },
        };

        // Only add customer_email if it exists and is valid
        if (email) {
            sessionPayload.customer_email = email;
        }

        const session = await stripe.checkout.sessions.create(sessionPayload);

        if (!session.url) {
            throw new Error('No session URL returned');
        }

        return { url: session.url };
    } catch (err: unknown) {
        console.error('Stripe Checkout Error:', err);
        return { error: (err as Error).message };
    }
}

/**
 * Checkout for a visitor who has no account yet.
 *
 * The sales page is the first thing a stranger sees, and asking her to create
 * an account before she has bought anything loses sales for no benefit — we
 * learn her email at checkout either way. Stripe collects it; the webhook
 * creates the account and emails her a link to set a password.
 *
 * Deliberately NOT the same function as createCheckoutSession: that one
 * requires a session and attaches client_reference_id, and blurring the two
 * would make it easy to accidentally drop the user id from a logged-in
 * purchase. `flow: 'guest'` marks these sessions so the webhook knows a
 * missing user id is expected here and a bug anywhere else.
 */
export async function createGuestCheckoutSession(
    priceId: string,
    returnUrl: string,
    welcomePath: string,
    /**
     * The language she is buying in. Recorded on the session because the
     * webhook — which sends the only email standing between her and the thing
     * she paid for — has no other way to know it. Without this every buyer
     * received an English set-password email.
     */
    locale: string = 'en'
) {
    if (!priceId) {
        return { error: 'Price ID is missing' };
    }

    const headersList = await headers();
    const origin =
        headersList.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{ price: priceId, quantity: 1 }],
            // Back to the welcome step, never to the sales page she just bought
            // from. {CHECKOUT_SESSION_ID} is substituted by Stripe on redirect.
            success_url: `${origin}${welcomePath}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}${returnUrl}`,
            // Stripe requires an email for a guest purchase; this is the identity
            // the account is created against.
            customer_creation: 'always',
            metadata: { flow: 'guest', locale: locale === 'es' ? 'es' : 'en' },
            phone_number_collection: { enabled: true },
        });

        if (!session.url) {
            throw new Error('No session URL returned');
        }

        return { url: session.url };
    } catch (err: unknown) {
        console.error('Stripe Guest Checkout Error:', err);
        return { error: (err as Error).message };
    }
}

/**
 * Everything a renewal needs, resolved from durable state.
 *
 * Not exported: a "use server" module may only export async functions that are
 * safe to call from a browser, and this is neither a form action nor something
 * a page should be able to ask for directly. Both renewal entry points go
 * through it so the quote she is shown and the amount she is charged cannot
 * drift apart.
 */
interface ResolvedRenewal {
    userId: string;
    email: string | undefined;
    stripeProductId: string;
    currency: string;
    amountCents: number;
    expiresAt: string;
}

/**
 * The amount she paid for this product the last time it was not a renewal.
 *
 * "Last time it was not a renewal" is the whole trick behind the lapse rule: a
 * purchase made after the grace window is itself a fresh full-price row, so it
 * silently becomes the new base and the ladder restarts with no streak-tracking
 * anywhere.
 */
async function findOriginalPayment(
    supabase: SupabaseClient,
    userId: string,
    productId: string
): Promise<{ cents: number; currency: string } | null> {
    const { data } = await supabase
        .from('purchases')
        .select('amount_paid, currency')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .eq('is_renewal', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const paid = Number(data?.amount_paid ?? 0);
    if (!paid || Number.isNaN(paid)) return null;

    return {
        cents: Math.round(paid * 100),
        currency: (data?.currency as string | null)?.toLowerCase() || 'usd',
    };
}

async function resolveRenewal(): Promise<ResolvedRenewal | { error: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.is_anonymous) {
        return { error: 'User must be logged in' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select(
            'has_full_unlock, has_course_pass, has_masterclass_pass, access_expires_at, access_renewal_count'
        )
        .eq('id', user.id)
        .maybeSingle();

    // A pass first: it is the larger entitlement, so renewing it renews
    // everything a single-item grant would have covered anyway.
    const passSlug = profile?.has_full_unlock
        ? 'full_access'
        : profile?.has_masterclass_pass
          ? 'masterclass_pass'
          : profile?.has_course_pass
            ? 'course_pass'
            : null;

    if (passSlug && profile?.access_expires_at) {
        // Not filtered on `active`: she is renewing what she bought, which may
        // well have been taken off sale since.
        const { data: offer } = await supabase
            .from('offers')
            .select('stripe_product_id')
            .eq('slug', passSlug)
            .maybeSingle();

        if (!offer?.stripe_product_id) {
            return { error: 'This access cannot be renewed automatically. Please get in touch.' };
        }

        const original = await findOriginalPayment(supabase, user.id, offer.stripe_product_id);
        if (!original) {
            // An admin grant or an imported account. Guessing a price here would
            // be inventing a number and charging her for it.
            return { error: 'We could not find your original purchase. Please get in touch.' };
        }

        return {
            userId: user.id,
            email: user.email,
            stripeProductId: offer.stripe_product_id,
            currency: original.currency,
            amountCents: renewalAmountCents(original.cents, profile.access_renewal_count ?? 0),
            expiresAt: profile.access_expires_at,
        };
    }

    // Otherwise a single masterclass or chapter. The one expiring soonest is the
    // one she is being asked about.
    const { data: grant } = await supabase
        .from('user_access_grants')
        .select('masterclass_id, chapter_id, expires_at, renewal_count')
        .eq('user_id', user.id)
        .not('expires_at', 'is', null)
        .order('expires_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (!grant?.expires_at) {
        return { error: 'There is nothing to renew on this account.' };
    }

    const table = grant.masterclass_id ? 'masterclasses' : 'chapters';
    const itemId = (grant.masterclass_id ?? grant.chapter_id) as string | null;
    if (!itemId) {
        return { error: 'There is nothing to renew on this account.' };
    }

    const { data: item } = await supabase
        .from(table)
        .select('stripe_product_id')
        .eq('id', itemId)
        .maybeSingle();

    if (!item?.stripe_product_id) {
        return { error: 'This access cannot be renewed automatically. Please get in touch.' };
    }

    const original = await findOriginalPayment(supabase, user.id, item.stripe_product_id);
    if (!original) {
        return { error: 'We could not find your original purchase. Please get in touch.' };
    }

    return {
        userId: user.id,
        email: user.email,
        stripeProductId: item.stripe_product_id,
        currency: original.currency,
        amountCents: renewalAmountCents(original.cents, grant.renewal_count ?? 0),
        expiresAt: grant.expires_at,
    };
}

/**
 * What her next year costs, and whether she can still have it at that price.
 *
 * Read-only. The banner in the Vault renders from this, and
 * `createRenewalCheckoutSession` recomputes the same thing rather than trusting
 * anything the page sends back — the price of a renewal is never a client fact.
 */
export async function getRenewalQuote(): Promise<
    | {
          amountCents: number;
          currency: string;
          expiresAt: string;
          graceEnd: string;
          renewable: boolean;
      }
    | { error: string }
> {
    const resolved = await resolveRenewal();
    if ('error' in resolved) return { error: resolved.error };

    return {
        amountCents: resolved.amountCents,
        currency: resolved.currency,
        expiresAt: resolved.expiresAt,
        graceEnd: graceEnds(resolved.expiresAt),
        renewable: withinGrace(resolved.expiresAt),
    };
}

/**
 * Renew the access she already holds, at her rung of the ladder.
 *
 * The price is an inline `price_data` rather than a stored Stripe price: it is
 * a function of what *she* paid, so there is no fixed price to point at. The
 * product is the one she originally bought, which is what lets the webhook
 * resolve it through the ordinary `grantAccessForProduct` path with no renewal
 * branch of its own — `kind: 'renewal'` only tells it to extend rather than
 * start, and to keep the row out of the next renewal's pricing lookup.
 */
export async function createRenewalCheckoutSession(returnUrl: string = '/vault') {
    const resolved = await resolveRenewal();
    if ('error' in resolved) return { error: resolved.error };

    if (!withinGrace(resolved.expiresAt)) {
        return {
            error:
                'Your renewal price has reset. Access is available again at the current price.',
        };
    }

    const headersList = await headers();
    const origin =
        headersList.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: resolved.currency,
                        product: resolved.stripeProductId,
                        unit_amount: resolved.amountCents,
                    },
                    quantity: 1,
                },
            ],
            success_url: `${origin}${returnUrl}?checkout_success=true`,
            cancel_url: `${origin}${returnUrl}`,
            client_reference_id: resolved.userId,
            metadata: { userId: resolved.userId, kind: 'renewal' },
            ...(resolved.email ? { customer_email: resolved.email } : {}),
        });

        if (!session.url) throw new Error('No session URL returned');
        return { url: session.url };
    } catch (err: unknown) {
        console.error('Stripe Renewal Checkout Error:', err);
        return { error: (err as Error).message };
    }
}
