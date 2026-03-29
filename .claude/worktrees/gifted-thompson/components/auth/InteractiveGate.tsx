"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { Lock } from "lucide-react";
import UnlockButton from "@/components/monetization/UnlockButton";

interface InteractiveGateProps {
    isLocked: boolean;
    children: React.ReactNode;
    fallback?: React.ReactNode; // Optional custom locked UI
    type?: "redirect" | "blur" | "overlay"; // How to gate
    title?: string;
    priceId?: string;
    isLoggedIn?: boolean;
}

export default function InteractiveGate({
    isLocked,
    children,
    type = "overlay",
    title = "Unlock Access",
    priceId,
    isLoggedIn = false
}: InteractiveGateProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handleUnlock = () => {
        // Save current location to return to
        if (typeof window !== "undefined") {
            localStorage.setItem("redirect_to", window.location.pathname);
        }
        setIsRedirecting(true);
        router.push("/vault/join");
    };

    if (!isLocked) {
        return <>{children}</>;
    }

    // Redirect Mode: Immediately redirect (used for Protected Routes)
    if (type === "redirect") {
        useEffect(() => {
            handleUnlock();
        }, []);
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] animate-pulse">
                <Lock className="w-8 h-8 text-ac-gold mb-4" />
                <p className="text-ac-taupe/60 font-serif">Checking access...</p>
            </div>
        );
    }

    // Overlay Mode: Show content blurred with CTA
    return (
        <div className="relative w-full h-full min-h-[300px] rounded-sm overflow-hidden bg-ac-sand/10 group">
            {/* Blurred Content Background (Optional: could render children with blur filter) */}
            <div className="absolute inset-0 filter blur-xl opacity-50 pointer-events-none select-none">
                {/* Abstract shapes or placeholder to imply content */}
                <div className="w-full h-full bg-ac-taupe/5" />
            </div>

            {/* Gate UI */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8 text-center bg-white/40 backdrop-blur-md">
                <div className="bg-white p-4 rounded-full shadow-lg mb-6 text-ac-gold">
                    <Lock size={32} />
                </div>

                <h3 className="font-serif text-2xl text-ac-taupe mb-2">
                    {title}
                </h3>
                <p className="text-ac-taupe/70 max-w-md mb-8">
                    Join the Inner Circle to unlock this content and access our full library of styling masterclasses.
                </p>

                <UnlockButton
                    priceId={priceId}
                    isLoggedIn={isLoggedIn}
                    returnUrl={typeof window !== 'undefined' ? window.location.pathname : '/vault'}
                    label={isRedirecting ? "Redirecting..." : "Unlock Access"}
                    className="bg-ac-gold hover:bg-ac-gold/90 text-white px-8 py-3 uppercase tracking-widest text-sm font-bold transition-all hover:scale-105 shadow-md disabled:opacity-70"
                />
            </div>
        </div>
    );
}
