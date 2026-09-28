"use client";

import { Link } from "@/i18n/routing";
import { useSessionKind } from "@/app/lib/use-session-kind";

/**
 * The way back in for a returning client, on the public sales page.
 *
 * "Sign in" for a visitor (and for an anonymous guest, who has no account to
 * be in); "Go to the Vault" for a member who is already signed in, so the
 * page never asks her to sign in to what she is signed in to. The page is
 * prerendered, so it says "Sign in" until the browser has checked — the right
 * answer for most readers, and a working link either way.
 */
export default function MemberEntryLink({
    signInLabel,
    enterVaultLabel,
    className,
}: {
    signInLabel: string;
    enterVaultLabel: string;
    className?: string;
}) {
    const member = useSessionKind() === "member";

    return (
        <Link href={member ? "/vault" : "/login"} className={className}>
            {member ? enterVaultLabel : signInLabel}
        </Link>
    );
}
