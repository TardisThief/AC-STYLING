"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { createSalesPageCheckout } from "@/app/actions/stripe";
import { trackCta, type CtaSection } from "@/app/lib/analytics";

/**
 * The single place the sales page turns intent into a Stripe session.
 *
 * Every CTA that sells goes through here. Whether she pays as a signed-in
 * member (attached by client_reference_id) or as a guest (an account created
 * from the email she pays with) is decided by the server action at click
 * time: the page is prerendered and cannot know who is looking.
 *
 * `priceId` can be absent while a course has no Stripe price yet — the button
 * says so rather than failing on click.
 */

interface Props {
    priceId: string | null;
    section: CtaSection;
    label: string;
    unavailableLabel: string;
    returnUrl?: string;
    className?: string;
}

export default function VaultCheckoutButton({
    priceId,
    section,
    label,
    unavailableLabel,
    returnUrl = "/vault",
    className,
}: Props) {
    const [loading, setLoading] = useState(false);
    const locale = useLocale();
    const unavailable = !priceId;

    const handleClick = async () => {
        if (unavailable || loading) return;

        trackCta(section, "checkout");
        setLoading(true);

        try {
            const result = await createSalesPageCheckout(priceId!, returnUrl, `/${locale}/welcome`, locale);

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

            toast.error("Checkout could not be started. Please try again.");
            setLoading(false);
        } catch {
            toast.error("Checkout could not be started. Please try again.");
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={unavailable || loading}
            aria-busy={loading}
            className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
        >
            {unavailable ? unavailableLabel : loading ? "…" : label}
        </button>
    );
}
