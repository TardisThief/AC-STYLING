"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { claimPurchase } from "@/app/actions/vault/claim-purchase";

/**
 * Set-password form shown immediately after a guest purchase.
 *
 * The emailed recovery link does the same job and still arrives; this exists
 * so someone who has just paid can be inside the Vault in one step instead of
 * leaving the tab to find an email.
 */

interface Props {
    sessionId: string;
    t: {
        passwordLabel: string;
        passwordHint: string;
        submit: string;
        working: string;
        signedOutNote: string;
    };
}

export default function ClaimAccessForm({ sessionId, t }: Props) {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);

        const result = await claimPurchase(sessionId, password);

        if (!result.success) {
            toast.error(result.error ?? "Something went wrong.");
            setLoading(false);
            return;
        }

        if (result.signedIn) {
            router.push("/vault");
            return;
        }

        // Password set but the session did not take — tell her plainly rather
        // than bouncing her to a login page with no explanation.
        toast.success(t.signedOutNote);
        router.push("/login");
    };

    return (
        <form onSubmit={onSubmit} className="mt-8 max-w-sm">
            <label htmlFor="claim-password" className="block text-sm text-ac-taupe">
                {t.passwordLabel}
            </label>
            <input
                id="claim-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full border border-ac-taupe/30 bg-white/60 px-4 py-3 text-ac-taupe focus-visible:border-ac-olive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-olive"
            />
            <p className="mt-2 text-sm text-ac-taupe">{t.passwordHint}</p>

            <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="mt-5 bg-ac-espresso px-8 py-4 text-xs font-bold uppercase tracking-widest text-ac-sand transition-colors hover:bg-ac-taupe focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-olive disabled:cursor-not-allowed disabled:opacity-60"
            >
                {loading ? t.working : t.submit}
            </button>
        </form>
    );
}
