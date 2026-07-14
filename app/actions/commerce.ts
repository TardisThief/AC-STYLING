'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { stripe } from '@/utils/stripe';
import { getErrorMessage } from '@/app/lib/errors';
import { grantAccessForProduct } from '@/app/lib/access-logic';

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

    if (!user || !user.email) return { error: "User or Email not found" };

    try {
        // 1. Fetch recent sessions (Last 100) and filter manually
        // ('search' API is not available in current SDK version)
        const sessions = await stripe.checkout.sessions.list({
            limit: 100,
            expand: ['data.line_items'],
        });

        const targetEmail = user.email.toLowerCase();

        let restoredCount = 0;

        for (const session of sessions.data) {
            // Check Payer Email (Guest or Customer)
            const payerEmail = session.customer_details?.email || session.customer_email;

            if (session.payment_status === 'paid' && payerEmail?.toLowerCase() === targetEmail) {
                const lineItems = session.line_items?.data || [];

                for (const item of lineItems) {
                    const stripeProductId = typeof item.price?.product === 'string'
                        ? item.price?.product
                        : (item.price?.product as { id?: string } | null)?.id;

                    if (stripeProductId) {
                        const granted = await grantAccessForProduct(supabase, user.id, stripeProductId);
                        if (granted) restoredCount++;
                    }
                }
            }
        }

        if (restoredCount > 0) {
            revalidatePath('/vault');
            return { success: true, message: `Restored ${restoredCount} purchases.` };
        } else {
            return { success: true, message: "No new purchases found to restore." };
        }

    } catch (err) {
        console.error("Sync Error:", err);
        return { error: getErrorMessage(err) };
    }
}
