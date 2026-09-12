"use server";

import { stripe } from '@/utils/stripe';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkEmailRateLimit } from '@/app/lib/rate-limit';
import { getErrorMessage } from '@/app/lib/errors';

/**
 * Turning a completed guest checkout into a usable login.
 *
 * The buyer arrives back from Stripe with a session id in the URL. That id is
 * the only thing identifying her at this point, and it is a weak credential —
 * it sits in browser history and can leak through a referrer — so it is
 * deliberately fenced in:
 *
 *   1. The Stripe session must exist and be genuinely paid.
 *   2. It must be recent (24h), so an old link in history is useless.
 *   3. The account it names must still carry `pending_password`, which only a
 *      webhook-created guest account ever has. The moment a password is set
 *      the flag clears, which makes the id inert and means this can never
 *      touch an established account.
 *   4. Rate limited per email.
 *
 * The emailed recovery link remains the stronger path and keeps working; this
 * is the fast lane, not a replacement for it.
 */

const MAX_SESSION_AGE_SECONDS = 24 * 60 * 60;

interface SessionInfo {
    ok: boolean;
    email?: string;
    /** False once a password exists — the form should not be offered again. */
    claimable?: boolean;
    /** True when payment is confirmed but the webhook has not landed yet. */
    pending?: boolean;
    error?: string;
}

async function loadPaidSession(sessionId: string) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') return { error: 'This payment is not complete.' };

    const ageSeconds = Math.floor(Date.now() / 1000) - (session.created ?? 0);
    if (ageSeconds > MAX_SESSION_AGE_SECONDS) {
        return { error: 'This link has expired. Use the link in your email instead.' };
    }

    const email = (session.customer_details?.email || session.customer_email || '')
        .trim()
        .toLowerCase();
    if (!email) return { error: 'No email on this payment.' };

    return { email };
}

async function findUser(email: string) {
    const admin = createAdminClient();
    for (let page = 1; page <= 10; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error || !data?.users?.length) return null;
        const hit = data.users.find((u) => u.email?.toLowerCase() === email);
        if (hit) return hit;
        if (data.users.length < 200) return null;
    }
    return null;
}

/** What the welcome page needs to decide what to render. */
export async function getPurchaseSession(sessionId: string): Promise<SessionInfo> {
    if (!sessionId) return { ok: false, error: 'Missing payment reference.' };

    try {
        const loaded = await loadPaidSession(sessionId);
        if ('error' in loaded) return { ok: false, error: loaded.error };

        const user = await findUser(loaded.email);

        // Stripe redirects the moment payment clears, which can beat the
        // webhook. Payment is confirmed either way — say so, and let her retry.
        if (!user) return { ok: true, email: loaded.email, pending: true };

        return {
            ok: true,
            email: loaded.email,
            claimable: user.user_metadata?.pending_password === true,
        };
    } catch (err) {
        console.error('[claim-purchase] getPurchaseSession:', err);
        return { ok: false, error: 'We could not verify this payment.' };
    }
}

/** Set the password for a freshly purchased account and sign her in. */
export async function claimPurchase(sessionId: string, password: string) {
    if (!sessionId) return { success: false, error: 'Missing payment reference.' };
    if (!password || password.length < 8) {
        return { success: false, error: 'Use at least 8 characters.' };
    }

    try {
        const loaded = await loadPaidSession(sessionId);
        if ('error' in loaded) return { success: false, error: loaded.error };
        const email = loaded.email;

        const rate = await checkEmailRateLimit(email, null);
        if (!rate.allowed) {
            return { success: false, error: 'Too many attempts. Try again in a few minutes.' };
        }

        const user = await findUser(email);
        if (!user) {
            return {
                success: false,
                error: 'Your account is still being set up. Try again in a moment, or use the link in your email.',
            };
        }

        // The one-shot gate. An account that already has a password is not
        // reachable through a Stripe session id, no matter who holds it.
        if (user.user_metadata?.pending_password !== true) {
            return {
                success: false,
                error: 'This account already has a password. Sign in, or reset it from the login page.',
            };
        }

        const admin = createAdminClient();
        const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
            password,
            user_metadata: { ...user.user_metadata, pending_password: false },
        });

        if (updateError) {
            console.error('[claim-purchase] updateUserById:', updateError);
            return { success: false, error: 'We could not set that password. Please try again.' };
        }

        // Sign in through the cookie-aware client so she lands in the Vault
        // already authenticated rather than at a login form.
        const { createClient } = await import('@/utils/supabase/server');
        const supabase = await createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
            // The password is set and correct; only the session failed. Sending
            // her to the login page is a worse outcome than a lie, so say so.
            console.error('[claim-purchase] signIn after claim:', signInError);
            return { success: true, signedIn: false };
        }

        return { success: true, signedIn: true };
    } catch (err) {
        console.error('[claim-purchase] claimPurchase:', err);
        return { success: false, error: getErrorMessage(err) };
    }
}
