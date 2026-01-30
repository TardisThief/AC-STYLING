'use server';

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

    let email = user.email;

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
        const sessionPayload: any = {
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
