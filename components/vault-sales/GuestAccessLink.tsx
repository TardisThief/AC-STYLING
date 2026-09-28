"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useLocale } from "next-intl";
import { navigateAfterAuthChange } from "@/app/lib/after-auth-change";
import { useSessionKind } from "@/app/lib/use-session-kind";

/**
 * "Log in as a guest", under the Full Access button.
 *
 * The same anonymous sign-in the login page's Guest button uses, sending the
 * visitor into the Vault instead of to Stripe. It is a secondary path, so it is
 * styled as a small italic link rather than competing with the checkout
 * button. It is a <button> because it does something (it signs in) rather
 * than navigate.
 *
 * Only for someone with no session at all. The sales page is prerendered, so
 * it used to show this to signed-in members too, and clicking it swapped her
 * real session for an anonymous one (2026-09-28 rehearsal). Hidden until the
 * browser has checked, so a member never sees it flash.
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
    const locale = useLocale();
    const [loading, setLoading] = useState(false);
    const sessionKind = useSessionKind();

    const enterAsGuest = async () => {
        setLoading(true);
        const { error } = await createClient().auth.signInAnonymously();
        if (error) {
            console.error("Guest login failed:", error);
            toast.error(errorLabel);
            setLoading(false);
            return;
        }
        // A full load in her language, so a Spanish visitor lands in /es/vault
        // with a freshly rendered layout (see navigateAfterAuthChange).
        navigateAfterAuthChange(`/${locale}/vault`);
    };

    if (sessionKind !== "none") return null;

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
