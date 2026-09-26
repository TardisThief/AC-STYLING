'use server';

import type Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { stripe } from '@/utils/stripe';
import { getErrorMessage } from '@/app/lib/errors';
import { fulfillLineItem } from '@/app/lib/fulfillment';

/**
 * Checks if a user has purchased a specific product.
 */
export async function checkPurchase(productId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    const { data } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('status', 'completed')
        .single();

    return !!data;
}

/**
 * Gets all purchases for the current user.
 */
export async function getUserPurchases() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data } = await supabase
        .from('purchases')
        .select('product_id')
        .eq('user_id', user.id)
        .eq('status', 'completed');

    return data?.map(p => p.product_id) || [];
}

/**
 * Syncs Stripe purchases for the current user.
 * Useful if webhooks fail (e.g. local dev).
 */
export async function syncStripePurchases() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email || !user.email_confirmed_at) {
        return { error: "Verify your email before restoring purchases." };
    }

    try {
        const sessions = await findHerSessions(user.email);

        const targetEmail = user.email.toLowerCase();

        let restoredCount = 0;
        // Already granted by the webhook, or being granted right now: her
        // purchase is real, just not newly restored by this call.
        let settledCount = 0;
        let pendingCount = 0;

        for (const session of sessions) {
            // Check Payer Email (Guest or Customer)
            const payerEmail = session.customer_details?.email || session.customer_email;

            const belongsToUser = session.client_reference_id
                ? session.client_reference_id === user.id
                : payerEmail?.toLowerCase() === targetEmail;
            if (session.payment_status === 'paid' && belongsToUser) {
                const lineItems = session.line_items?.data || [];

                for (const item of lineItems) {
                    const stripeProductId = typeof item.price?.product === 'string'
                        ? item.price?.product
                        : (item.price?.product as { id?: string } | null)?.id;

                    if (stripeProductId) {
                        // Stripe identity/payment are verified above. Browser
                        // clients cannot write entitlement fields after migration 12.
                        //
                        // Through the webhook's own per-line-item path, never
                        // straight to the grant: this runs on every checkout
                        // return, usually seconds after the webhook, and a
                        // grant is a year of access. A line item the webhook
                        // has settled (or is settling) is skipped.
                        const { createAdminClient } = await import('@/utils/supabase/admin');
                        const outcome = await fulfillLineItem(
                            createAdminClient(),
                            {
                                lineItemId: item.id,
                                sessionId: session.id,
                                eventId: `restore:${session.id}`,
                                userId: user.id,
                                productId: stripeProductId,
                                amountTotal: item.amount_total,
                                currency: item.currency,
                            },
                            { isRenewal: session.metadata?.kind === 'renewal' }
                        );
                        if (outcome === 'granted') restoredCount++;
                        else if (outcome === 'already_settled') settledCount++;
                        else if (outcome === 'in_progress') pendingCount++;
                    }
                }
            }
        }

        if (restoredCount > 0) revalidatePath('/vault');
        const counts = { restored: restoredCount, settled: settledCount, pending: pendingCount };
        if (restoredCount > 0) {
            return { success: true, ...counts, message: `Restored ${restoredCount} purchases.` };
        } else {
            return { success: true, ...counts, message: "No new purchases found to restore." };
        }

    } catch (err) {
        console.error("Sync Error:", err);
        return { error: getErrorMessage(err) };
    }
}

/** Bound on pages of her own sessions, so a pathological history cannot run forever. */
const MAX_SESSION_PAGES = 20;

/**
 * Her checkout sessions, not merely the account's latest.
 *
 * This used to list the account's last 100 sessions — everyone's — and look
 * for hers among them, so once 100 other checkouts had happened since hers it
 * could not see her purchase at all (SCALE-001,
 * tests/integration/fulfillment.test.ts). Stripe filters on
 * customer_details.email exactly, so hers are fetched by her email, every
 * page. The latest 100 are still read as well: that filter is an exact match,
 * and a guest who typed her address in a different case at checkout would
 * otherwise be missed. The caller still checks each session belongs to her.
 */
async function findHerSessions(email: string): Promise<Stripe.Checkout.Session[]> {
    const found = new Map<string, Stripe.Checkout.Session>();

    let startingAfter: string | undefined;
    for (let page = 0; page < MAX_SESSION_PAGES; page++) {
        const { data, has_more } = await stripe.checkout.sessions.list({
            customer_details: { email },
            limit: 100,
            expand: ['data.line_items'],
            ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const session of data) found.set(session.id, session);
        if (!has_more || data.length === 0) break;
        startingAfter = data[data.length - 1].id;
    }

    const recent = await stripe.checkout.sessions.list({ limit: 100, expand: ['data.line_items'] });
    for (const session of recent.data) found.set(session.id, session);

    return [...found.values()];
}
