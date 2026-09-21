"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "@/i18n/routing";

/**
 * "Log in as a guest", under the Full Access button.
 *
 * The same anonymous sign-in the login page's Guest button uses, sending the
 * visitor into the Vault instead of to Stripe. It is a secondary path, so it is
 * styled as a small italic link rather than competing with the checkout
 * button. It is a <button> because it does something (it signs in) rather
 * than navigate.
 */
export default function GuestAccessLink({
    label,
    loadingLabel,
    errorLabel,
    className,
}: {
    label: string;
    loadingLabel: string;
    errorLabel: string;
    className?: string;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const enterAsGuest = async () => {
        setLoading(true);
        const { error } = await createClient().auth.signInAnonymously();
        if (error) {
            console.error("Guest login failed:", error);
            toast.error(errorLabel);
            setLoading(false);
            return;
        }
        // Locale-aware router, so a Spanish visitor lands in /es/vault.
        router.push("/vault");
    };

    return (
        <button
            type="button"
            onClick={enterAsGuest}
            disabled={loading}
            aria-busy={loading}
            className={className}
        >
            {loading ? loadingLabel : label}
        </button>
    );
}
