"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createRenewalCheckoutSession } from "@/app/actions/stripe";
import { trackCta } from "@/app/lib/analytics";

/**
 * The client boundary around the renewal action, and nothing else.
 *
 * The price is not a prop and is never sent to the server: the action resolves
 * what she holds and what she paid for it on its own. The label carries the
 * number only so she can read it before clicking.
 */
interface Props {
    label: string;
    errorLabel: string;
    returnUrl?: string;
    className?: string;
}

export default function RenewAccessButton({
    label,
    errorLabel,
    returnUrl = "/vault",
    className,
}: Props) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        if (loading) return;

        trackCta("renewal", "checkout");
        setLoading(true);

        try {
            const result = await createRenewalCheckoutSession(returnUrl);

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

            toast.error(errorLabel);
            setLoading(false);
        } catch {
            toast.error(errorLabel);
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            aria-busy={loading}
            className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}
        >
            {loading ? "…" : label}
        </button>
    );
}
