import type { SupabaseClient, User } from '@supabase/supabase-js';
import { revokeUnprovenPassword } from '@/app/lib/auth-links';

/**
 * Turn a paid guest checkout into an account.
 *
 * Before this, a checkout session with no `client_reference_id` hit the
 * webhook, logged "No userId found in session" and returned 200 — Stripe
 * considered the delivery successful and the purchase was gone. Money taken,
 * nothing granted, no retry. That was the worst failure mode in the system.
 *
 * Resolution order matters:
 *   1. An existing account for that email is reused. Never create a duplicate:
 *      someone who already has a login and buys again from the marketing page
 *      must end up in the account she already has.
 *   2. Otherwise create the user, email-confirmed, with no password. She sets
 *      one through the recovery link the caller sends, or through the
 *      single-use `purchase_claims` credential the caller mints.
 *
 * No `pending_password` marker is written any more. It used to gate the
 * set-password fast lane, but `user_metadata` is writable by the account it
 * describes, and nothing cleared it on the recovery path — see
 * app/lib/purchase-claims.ts and migration 13.
 *
 * `needsWayIn` is whether she still needs the welcome email and its claim:
 * true for an account nobody has ever signed in to, whether this delivery
 * created it or an earlier, failed one did. It used to be read off `created`,
 * so a retry of a delivery that created the account and then failed sent her
 * nothing (PAY-002, tests/unit/guest-purchase.test.ts).
 *
 * An existing account nobody has proved the mailbox of may carry a password
 * someone else set at /vault/join; the welcome link would confirm it and make
 * that password usable. It is replaced before anything is attached (SEC-001,
 * see revokeUnprovenPassword).
 *
 * Returns null when the email itself is unusable, or when that password could
 * not be replaced, which the caller must treat as a hard failure (500) so
 * Stripe retries rather than dropping it.
 */
export async function resolveOrCreateUserByEmail(
    admin: SupabaseClient,
    email: string | null | undefined,
    fullName?: string | null
): Promise<{ userId: string; created: boolean; needsWayIn: boolean } | null> {
    const clean = email?.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return null;

    // A miss here would create a duplicate account, so it is worth being explicit.
    const existing = await findUserByEmail(admin, clean);
    if (existing) return attachToExisting(admin, existing);

    const { data, error } = await admin.auth.admin.createUser({
        email: clean,
        // She has paid; making her verify an address Stripe already charged
        // adds a step that can only lose her.
        email_confirm: true,
        user_metadata: {
            ...(fullName ? { full_name: fullName } : {}),
        },
    });

    if (error || !data?.user) {
        // A race with a parallel delivery can lose createUser; re-resolve
        // before giving up, so a duplicate webhook does not 500 forever.
        const raced = await findUserByEmail(admin, clean);
        if (raced) return attachToExisting(admin, raced);

        console.error('[guest-purchase] createUser failed:', error);
        return null;
    }

    return { userId: data.user.id, created: true, needsWayIn: true };
}

async function attachToExisting(
    admin: SupabaseClient,
    user: User
): Promise<{ userId: string; created: false; needsWayIn: boolean } | null> {
    if (!(await revokeUnprovenPassword(admin, user))) return null;
    return { userId: user.id, created: false, needsWayIn: !user.last_sign_in_at };
}

/**
 * The auth user with this email, or null.
 *
 * Through auth_user_id_by_email (migration 31, service role only), then the
 * admin API for the full user. This used to page through listUsers — which
 * has no email filter in this SDK version — for at most 10 x 200 users, so
 * past the 2,000th account a returning buyer was simply not found (SCALE-001,
 * tests/unit/guest-purchase.test.ts). Shared with the /welcome page.
 *
 * Throws on a failed lookup: "could not look" is not "no such account", and
 * treating it as one would create a duplicate.
 */
export async function findUserByEmail(
    admin: SupabaseClient,
    email: string
): Promise<User | null> {
    const { data: id, error } = await admin.rpc('auth_user_id_by_email', { p_email: email });
    if (error) throw new Error(`account lookup failed: ${error.message}`);
    if (!id) return null;

    const { data, error: userError } = await admin.auth.admin.getUserById(id as string);
    if (userError) throw new Error(`account read failed: ${userError.message}`);
    return data?.user ?? null;
}

/**
 * The link a new buyer uses to pick a password.
 *
 * `recovery` rather than `invite`: the account already exists and is
 * confirmed, and recovery links work whether or not she ever had a password.
 */
export async function generateSetPasswordLink(
    admin: SupabaseClient,
    email: string,
    redirectTo: string
): Promise<string | null> {
    const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
    });

    if (error || !data?.properties?.action_link) {
        console.error('[guest-purchase] generateLink failed:', error);
        return null;
    }

    return data.properties.action_link;
}
