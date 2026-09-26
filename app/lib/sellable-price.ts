import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Whether the catalogue is currently selling this Stripe price.
 *
 * Checkout used to take the price id from the browser and hand it to Stripe,
 * so a direct call to the action could buy any active price in the Stripe
 * account — an unpublished masterclass, a retired offer, a cheaper legacy
 * price on a product that grants access (PAY-004,
 * tests/integration/checkout-price.test.ts). The sales page hiding a button
 * was the only thing standing in the way.
 *
 * Sellable means one of the places the site sells from carries this exact
 * price and is live: an active offer, a published masterclass or chapter, or
 * an active service. Read with the service role, because `offers` is visible
 * to members only when active and the answer must not depend on who asks.
 *
 * Renewals do not come through here: they are priced from the buyer's own
 * purchase history, never from a price id she supplies.
 *
 * Fails closed: a read that errors counts as "not selling".
 */
export async function isSellablePrice(admin: SupabaseClient, priceId: string): Promise<boolean> {
    const sources = [
        admin.from('offers').select('id').eq('price_id', priceId).eq('active', true),
        admin.from('masterclasses').select('id').eq('price_id', priceId).eq('is_published', true),
        admin.from('chapters').select('id').eq('price_id', priceId).eq('is_published', true),
        admin.from('services').select('id').eq('price_id', priceId).eq('active', true),
    ];

    const results = await Promise.all(sources);
    for (const { data, error } of results) {
        if (error) {
            console.error('[sellable-price] catalogue read failed:', error.message);
            return false;
        }
        if (data && data.length > 0) return true;
    }
    return false;
}
