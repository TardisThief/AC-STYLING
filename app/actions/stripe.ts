'use server';

import type Stripe from 'stripe';
import { stripe } from '@/utils/stripe';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

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
