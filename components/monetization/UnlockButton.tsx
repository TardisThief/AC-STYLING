'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { createCheckoutSession, createGuestCheckoutSession } from '@/app/actions/stripe';

/**
 * Buy a single masterclass or course from inside the Vault.
 *
 * Pay first, account afterwards — the same flow `/vault-access` uses. This
 * used to push anyone without a session to `/vault/join`, and to call
 * `createCheckoutSession` for everyone else, which meant a guest (an anonymous
 * Supabase user, so `isAuthenticated` was true) hit a server action that
 * answers "User must be logged in" and nothing happened at all. Two different
 * dead ends for the two kinds of visitor most likely to be buying.
 */
interface UnlockButtonProps {
    priceId?: string;
    /**
     * A real account — NOT merely "has a session". A guest signed in
     * anonymously must be false here, or checkout refuses her; pass
     * `isAuthenticated && !user.is_anonymous`.
     */
    isSignedIn: boolean;
    returnUrl: string;
    label: string;
    comingSoonLabel: string;
    className?: string;
}

export default function UnlockButton({
    priceId,
    isSignedIn,
    returnUrl,
    label,
    comingSoonLabel,
    className
}: UnlockButtonProps) {
    const [loading, setLoading] = useState(false);
    const locale = useLocale();

    // Nothing to sell yet. Said plainly rather than failing on click.
    const isComingSoon = !priceId;
    const isDisabled = loading || isComingSoon;

    const handleUnlock = async () => {
        if (isDisabled || !priceId) return;

        setLoading(true);
        try {
            const result = isSignedIn
                ? await createCheckoutSession(priceId, returnUrl)
                : await createGuestCheckoutSession(priceId, returnUrl, `/${locale}/welcome`, locale);

            if (result.error) {
                toast.error(result.error);
                setLoading(false);
                return;
            }

            if (result.url) {
                // Not resetting `loading`: the tab is navigating away, and a
                // button that springs back to life invites a second charge.
                window.location.href = result.url;
                return;
            }

            toast.error('Checkout could not be started. Please try again.');
            setLoading(false);
        } catch {
            toast.error('Checkout could not be started. Please try again.');
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleUnlock}
            disabled={isDisabled}
            aria-busy={loading}
            className={className || "inline-flex items-center gap-2 bg-ac-gold text-white px-8 py-4 rounded-sm hover:bg-ac-gold/90 transition-all hover:scale-105 shadow-md uppercase tracking-widest text-xs font-bold disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"}
        >
            {loading ? '…' : isComingSoon ? comingSoonLabel : label}
        </button>
    );
}
