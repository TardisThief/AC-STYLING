'use server';

import { createClient } from '@/utils/supabase/server';
import { sendEmail } from '@/lib/resend';
import { getMagicLinkHtml, getPasswordResetHtml } from '@/lib/email-templates';
import { headers } from 'next/headers';

export async function signInWithMagicLink(email: string, redirectTo?: string) {
    console.log('--- signInWithMagicLink START ---', email);
    const origin = (await headers()).get('origin');
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();

    // 1. Generate Link
    console.log('Generating Magic Link...');
    const url = new URL(`${origin}/auth/confirm`);
    if (redirectTo) {
        url.searchParams.set('next', redirectTo);
    }

    const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
            redirectTo: url.toString(),
        },
    });

    if (error) {
        console.error('Error generating magic link:', error);
        return { error: 'Could not generate login link. Please try again.' };
    }

    const { properties } = data;

    // 2. Send Email
    if (properties?.action_link) {
        console.log('Sending Email to:', email);
        const { success, error: emailError } = await sendEmail({
            to: email,
            subject: 'Sign in to AC Styling',
            html: getMagicLinkHtml(properties.action_link),
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
    const origin = (await headers()).get('origin');
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();

    // 1. Generate Link
    const url = new URL(`${origin}/auth/confirm`);
    url.searchParams.set('next', '/update-password');

    const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
            redirectTo: url.toString()
        },
    });

    if (error) {
        console.error('Error generating recovery link:', error);
        return { error: 'Could not generate reset link. Please try again.' };
    }

    const { properties } = data;

    // 2. Send Email
    if (properties?.action_link) {
        console.log('Sending Reset Email to:', email);
        const { success, error: emailError } = await sendEmail({
            to: email,
            subject: 'Reset your AC Styling Password',
            html: getPasswordResetHtml(properties.action_link),
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
    const origin = (await headers()).get('origin');
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const adminSupabase = createAdminClient();

    // 1. Try to generate Link (works if user exists)
    console.log('Attempting to generate link for existing user...');
    const confirmUrl = new URL(`${origin}/auth/confirm`);
    if (redirectTo) {
        confirmUrl.searchParams.set('next', redirectTo);
    }

    let { data, error } = await adminSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: confirmUrl.toString() }
    });

    // 1b. If user exists but is unverified, Supabase might calculate type='signup'.
    // We want to force 'magiclink' for a smoother login experience (since we are verifying via email).
    if (data?.user && !data.user.email_confirmed_at) {
        console.log('User exists but is unverified. Auto-verifying and regenerating link...');
        // Confirm the user
        await adminSupabase.auth.admin.updateUserById(data.user.id, {
            email_confirm: true,
            user_metadata: { ...data.user.user_metadata, email_verified: true }
        });

        // Regenerate link as proper magiclink
        const retry = await adminSupabase.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: { redirectTo: confirmUrl.toString() }
        });
        if (retry.data) data = retry.data;
        if (retry.error) error = retry.error;
    }

    // 2. If User Not Found, Create User First
    if (error && error.message.includes("User not found")) {
        console.log('User not found. Creating new user...');
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
            options: { redirectTo: confirmUrl.toString() }
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
        console.log('Sending Signup Email via Resend to:', email);
        console.log('Action Link:', properties.action_link);
        const { success, error: emailError } = await sendEmail({
            to: email,
            subject: 'Welcome to AC Styling',
            html: getMagicLinkHtml(properties.action_link),
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
    const origin = (await headers()).get('origin');

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
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || origin}/auth/confirm?next=${encodeURIComponent(redirectTo)}`,
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
            subject: 'Welcome to AC Styling - Confirm your account',
            html: getMagicLinkHtml(properties.action_link), // Reusing magic link template for confirmation
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
