import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeNextPath } from '@/app/lib/safe-redirect';

// The locales i18n/routing.ts serves. Not imported from there: that module
// also builds next-intl's client navigation, which a server-only helper must
// not pull in. i18n/request.ts keeps the same list for the same reason.
const LOCALES = ['en', 'es'];
const DEFAULT_LOCALE = 'en';

/**
 * Where an auth email sends its reader: the localized confirmation page.
 *
 * It used to be `/auth/confirm`, which does not exist. The page lives at
 * `/[locale]/confirm`, and the proxy matcher skips `auth/*`, so nothing ever
 * redirected it — every login, signup, reset and join email ended on a 404
 * (tests/unit/auth-email-links.test.ts).
 *
 * The locale is the one the form was on, so a Spanish reader stays in
 * Spanish; anything the site does not serve falls back to the default rather
 * than to a path that 404s. `next` is kept only if it stays on this site.
 */
export function authConfirmUrl(
    origin: string,
    locale: string | null | undefined,
    next?: string | null
): string {
    const served = LOCALES.includes(locale ?? '') ? (locale as string) : DEFAULT_LOCALE;
    const url = new URL(`/${served}/confirm`, origin);
    if (next) {
        const safe = safeNextPath(next, '');
        if (safe) url.searchParams.set('next', safe);
    }
    return url.toString();
}

/**
 * Before a link goes to an account nobody has proved the mailbox of, make
 * sure no one else holds a password to it.
 *
 * /vault/join creates an unconfirmed account with a password, from nothing
 * but an email address typed into a form — anyone can do that for anyone's
 * address. Opening an emailed link then confirms the account, and a confirmed
 * account accepts that password. So a victim who later signs in by magic link,
 * resets a password, or buys as a guest (which reuses the account by email)
 * would be handing an account to whoever registered her address first.
 *
 * Replacing the password with one nobody knows closes that. It costs a real
 * owner of an unconfirmed account nothing she could use: an unconfirmed
 * account cannot sign in with its password anyway, and the email being sent
 * is itself a way in. It never confirms the account — only opening the email
 * does that (tests/unit/auth-email-links.test.ts, SEC-001).
 *
 * Returns false when the password could not be replaced; the caller must then
 * not send the link.
 */
export async function revokeUnprovenPassword(
    admin: SupabaseClient,
    user: { id: string; email_confirmed_at?: string | null } | null | undefined
): Promise<boolean> {
    if (!user || user.email_confirmed_at) return true;

    const { error } = await admin.auth.admin.updateUserById(user.id, {
        password: randomBytes(32).toString('base64url'),
    });
    if (error) {
        console.error('[auth-links] could not revoke the password on an unconfirmed account:', error.message);
        return false;
    }
    return true;
}
