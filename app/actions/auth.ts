'use server';

import { createClient } from '@/utils/supabase/server';
import { sendEmail } from '@/lib/resend';
import { emailLocale, getAuthEmailSubject, getMagicLinkHtml, getPasswordResetHtml, getSignupConfirmHtml } from '@/lib/email-templates';
import { headers } from 'next/headers';
import { checkEmailRateLimit } from '@/app/lib/rate-limit';
import { getLocale } from 'next-intl/server';
import { authConfirmUrl, revokeUnprovenPassword } from '@/app/lib/auth-links';

/**
 * The locale of the page the form was submitted from. A server action is
 * POSTed to that page's URL, which the proxy runs next-intl on, so this is
 * the reader's language. English if it cannot be determined — /en/confirm
 * still works, it is just in the wrong language.
 */
async function formLocale(): Promise<string> {
    try {
        return await getLocale();
    } catch {
        return 'en';
    }
}

/** The origin the form was posted from, or the configured site if absent. */
function siteOrigin(origin: string | null): string {
    return origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

export async function signInWithMagicLink(email: string, redirectTo?: string) {
    console.log('--- signInWithMagicLink START ---', email);
    const hdrs = await headers();
    const origin = hdrs.get('origin');
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null;
    const rate = await checkEmailRateLimit(email, ip);
    if (!rate.allowed) {
        return { error: 'Too many requests. Please try again in a few minutes.' };
    }
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();

    // 1. Generate Link
    console.log('Generating Magic Link...');
    const locale = await formLocale();
    const confirmUrl = authConfirmUrl(siteOrigin(origin), locale, redirectTo);

    const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
            redirectTo: confirmUrl,
        },
    });

    if (error) {
        console.error('Error generating magic link:', error);
        return { error: 'Could not generate login link. Please try again.' };
    }

    // Opening this link confirms the account; see revokeUnprovenPassword.
    if (!(await revokeUnprovenPassword(supabase, data.user))) {
        return { error: 'Could not generate login link. Please try again.' };
    }

    const { properties } = data;

    // 2. Send Email
    if (properties?.action_link) {
        console.log('Sending Email to:', email);
        const { success, error: emailError } = await sendEmail({
            to: email,
            subject: getAuthEmailSubject('signin', emailLocale(locale)),
            html: getMagicLinkHtml(properties.action_link, emailLocale(locale)),
        });

        if (!success) {
            console.error('Error sending magic link email:', emailError);
            return { error: 'Failed to send email. Please try again.' };
        }
    } else {
        return { error: 'Failed to generate link (No Action Link)' };
    }

    return { success: true };
}

export async function requestPasswordReset(email: string) {
    console.log('--- requestPasswordReset START ---', email);
    const hdrs = await headers();
    const origin = hdrs.get('origin');
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null;
    const rate = await checkEmailRateLimit(email, ip);
    if (!rate.allowed) {
        return { error: 'Too many requests. Please try again in a few minutes.' };
    }
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();

    // 1. Generate Link
    const locale = await formLocale();
    const confirmUrl = authConfirmUrl(siteOrigin(origin), locale, `/${locale}/update-password`);

    const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
            redirectTo: confirmUrl
        },
    });

    if (error) {
        console.error('Error generating recovery link:', error);
        return { error: 'Could not generate reset link. Please try again.' };
    }

    // Opening this link confirms the account; see revokeUnprovenPassword.
    if (!(await revokeUnprovenPassword(supabase, data.user))) {
        return { error: 'Could not generate reset link. Please try again.' };
    }

    const { properties } = data;

    // 2. Send Email
    if (properties?.action_link) {
        console.log('Sending Reset Email to:', email);
        const { success, error: emailError } = await sendEmail({
            to: email,
            subject: getAuthEmailSubject('reset', emailLocale(locale)),
            html: getPasswordResetHtml(properties.action_link, emailLocale(locale)),
        });

        if (!success) {
            console.error('Error sending reset email:', emailError);
            return { error: 'Failed to send email. Please try again.' };
        }
    }

    return { success: true };
}

export async function signUpWithMagicLink(email: string, redirectTo?: string) {
    console.log('--- signUpWithMagicLink START ---', email);
    const hdrs = await headers();
    const origin = hdrs.get('origin');
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null;
    const rate = await checkEmailRateLimit(email, ip);
    if (!rate.allowed) {
        return { error: 'Too many requests. Please try again in a few minutes.' };
    }
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const adminSupabase = createAdminClient();

    // 1. Try to generate Link (works if user exists)
    console.log('Attempting to generate link for existing user...');
    const locale = await formLocale();
    const confirmUrl = authConfirmUrl(siteOrigin(origin), locale, redirectTo);
    // A brand-new account gets the welcome copy, an existing one the sign-in
    // copy ("Welcome back" would greet a new member as a returning one).
    let createdNow = false;

    let { data, error } = await adminSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: confirmUrl }
    });

    // 1b. An existing account nobody has proved the mailbox of. This used to
    // be marked confirmed right here, by a public action, before any email was
    // opened — which made a password someone else set at /vault/join usable
    // (SEC-001). Opening the link is the proof, and confirms it; until then,
    // make sure no one else holds a password to it.
    if (data?.user && !(await revokeUnprovenPassword(adminSupabase, data.user))) {
        return { error: 'Could not generate login link. Please try again.' };
    }

    // 2. If User Not Found, Create User First
    if (error && error.message.includes("User not found")) {
        console.log('User not found. Creating new user...');
        createdNow = true;
        // Confirmed but with NO password: the emailed link is the only way in,
        // so there is nothing here for anyone but the mailbox's owner to use.
        const { error: createError } = await adminSupabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { email_verified: true }
        });

        if (createError) {
            console.error("Error creating user:", createError);
            return { error: "Failed to create account." };
        }

        console.log('User created. Generating link...');
        const result = await adminSupabase.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: { redirectTo: confirmUrl }
        });
        data = result.data;
        error = result.error;
    }

    if (error) {
        console.error('Error generating magic link:', error);
        return { error: 'Could not generate login link. Please try again.' };
    }

    console.log('Magic Link Generated. Properties:', data.properties ? 'Present' : 'Missing');
    const { properties } = data;

    // 3. Send Email
    if (properties?.action_link) {
        // NB: never log properties.action_link — it contains a usable auth token.
        const { success, error: emailError } = await sendEmail({
            to: email,
            subject: getAuthEmailSubject(createdNow ? 'signup' : 'signin', emailLocale(locale)),
            html: createdNow
                ? getSignupConfirmHtml(properties.action_link, emailLocale(locale))
                : getMagicLinkHtml(properties.action_link, emailLocale(locale)),
        });

        if (!success) {
            console.error('Error sending magic link email:', emailError);
            return { error: 'Failed to send email. Please try again.' };
        }
        console.log('Email sent successfully.');
    } else {
        console.error('No action_link found in response', data);
    }

    console.log('--- signUpWithMagicLink END ---');
    return { success: true };
}

export async function signUpSeamless(formData: FormData, redirectTo: string) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;

    if (!email || !password || !fullName) {
        return { error: 'Please fill in all fields.' };
    }

    const { createAdminClient } = await import("@/utils/supabase/admin");
    const adminSupabase = createAdminClient();
    const hdrs = await headers();
    const origin = hdrs.get('origin');
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null;
    const rate = await checkEmailRateLimit(email, ip);
    if (!rate.allowed) {
        return { error: 'Too many requests. Please try again in a few minutes.' };
    }
    const locale = await formLocale();

    // 1. Create User (Admin)
    // We set email_confirm: false to require verification (standard security)
    const { data: user, error: createError } = await adminSupabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name: fullName },
        email_confirm: false
    });

    if (createError) {
        console.error('Signup Error:', createError);
        return { error: createError.message };
    }

    // 2. Generate Branded Confirmation Link
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
            redirectTo: authConfirmUrl(process.env.NEXT_PUBLIC_SITE_URL || siteOrigin(origin), locale, redirectTo),
            data: { full_name: fullName } // redundant but safe
        },
    });

    if (linkError) {
        console.error('Error generating signup link:', linkError);
        return { error: 'Failed to generate verification link.' };
    }

    // 3. Send Email via Resend
    const { properties } = linkData;
    if (properties?.action_link) {
        const { success, error: emailError } = await sendEmail({
            to: email,
            // Its own copy: it used to reuse the sign-in email's "Welcome back".
            subject: getAuthEmailSubject('signup', emailLocale(locale)),
            html: getSignupConfirmHtml(properties.action_link, emailLocale(locale)),
        });

        if (!success) {
            console.error('Error sending confirmation email:', emailError);
            return { error: 'Failed to send confirmation email.' };
        }
    } else {
        return { error: 'System error: No confirmation link generated.' };
    }

    return { success: true };
}

export async function linkIntakeProfile(token: string) {
    // Delegate to the robust activation logic in studio actions
    const { activateStudioAccess } = await import('@/app/actions/studio');
    return activateStudioAccess(token);
}
