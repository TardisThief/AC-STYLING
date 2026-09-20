"use server";

import { consumeClaimsForUser } from '@/app/lib/purchase-claims';

/**
 * Close every outstanding purchase-claim window for the signed-in account.
 *
 * This is the half of F06 that did not exist. Setting a password through the
 * emailed recovery link goes through `supabase.auth.updateUser({ password })`,
 * which knows nothing about the Stripe-session fast lane — so a buyer who used
 * the path we actively recommend left the weaker credential live for the rest
 * of its 24 hours. Anyone holding that session id could then overwrite her
 * password.
 *
 * The user is identified from the session cookie, never from an argument.
 * There is no parameter to forge: the worst a caller can do is close their own
 * windows, which is the intended effect.
 *
 * Never throws. A password change must not fail because this bookkeeping did;
 * the claim still expires on its own, and refusing the password change would
 * be the worse outcome.
 */
export async function closePurchaseClaims(): Promise<{ closed: number }> {
    try {
        const { createClient } = await import('@/utils/supabase/server');
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { closed: 0 };

        const { createAdminClient } = await import('@/utils/supabase/admin');
        const closed = await consumeClaimsForUser(createAdminClient(), user.id);

        if (closed > 0) {
            console.log(`[close-purchase-claims] closed ${closed} claim(s) for ${user.id}`);
        }

        return { closed };
    } catch (err) {
        console.error('[close-purchase-claims] failed:', err);
        return { closed: 0 };
    }
}
