'use client';

import { useState } from 'react';
import { Unlock } from 'lucide-react';
import { createCheckoutSession } from '@/app/actions/stripe';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface UnlockButtonProps {
    priceId?: string;
    isLoggedIn: boolean;
    returnUrl: string;
    label?: string;
    className?: string; // Allow custom styling to match usages
    variant?: 'primary' | 'card'; // primary = big button, card = small card overlay button? (Not really needed if we pass className, but good for defaults)
}

export default function UnlockButton({
    priceId,
    isLoggedIn,
    returnUrl,
    label = "Unlock Access",
    className
}: UnlockButtonProps) {
    console.log('[UnlockButton] Rendered. isLoggedIn:', isLoggedIn, 'priceId:', priceId);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Visual State Calculation
    const isMember = isLoggedIn;
    const hasPrice = !!priceId;

    // If member and no price, it's not ready. If guest, we always allow "Join" (unless strictly closed?)
    // For now, Guest -> Join is always allowed. Member -> Purchase requires Price.
    const isComingSoon = isMember && !hasPrice;

    const displayLabel = isComingSoon ? "Coming Soon" : label;
    const isDisabled = loading || isComingSoon;

    const handleUnlock = async () => {
        if (isDisabled) return;

        if (!isLoggedIn) {
            // Guest -> Redirect to Join (Auth Flow)
            if (typeof window !== 'undefined') {
                localStorage.setItem('redirect_to', returnUrl);
            }
            router.push('/vault/join');
            return;
        }

        if (!priceId) {
            // Should be caught by isComingSoon, but safety check
            toast.error("This item is not available for purchase yet.");
            return;
        }
        //...

        setLoading(true);
        try {
            const result = await createCheckoutSession(priceId, returnUrl);
            if (result.error) {
                toast.error(result.error);
            } else if (result.url) {
                window.location.href = result.url;
            }
        } catch (error) {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleUnlock}
            disabled={isDisabled}
            className={className || "inline-flex items-center gap-2 bg-ac-gold text-white px-8 py-4 rounded-sm hover:bg-ac-gold/90 transition-all hover:scale-105 shadow-md uppercase tracking-widest text-xs font-bold disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"}
        >
            {loading ? (
                <span className="animate-pulse">Processing...</span>
            ) : (
                <>
                    {!isComingSoon && <Unlock size={16} />}
                    {displayLabel}
                </>
            )}
        </button>
    );
}
