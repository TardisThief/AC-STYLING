"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { processOnboarding } from "@/app/actions/onboarding";

export default function AuthConfirmPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState("Verifying authentication...");

    // Params that might be in URL if PKCE or simple redirect
    const nextUrl = searchParams.get('next');

    useEffect(() => {
        const supabase = createClient();
        let mounted = true;

        const finalize = async (userId: string) => {
            console.log('[Confirm] Finalizing onboarding for:', userId);
            setStatus("Finalizing your account...");
            try {
                const result = await processOnboarding();
                if (result.success) {
                    toast.success("Welcome to the Studio!");
                } else {
                    console.error("Onboarding warning:", result.error);
                }
            } catch (err) {
                console.error("Onboarding failed:", err);
            }

            const target = nextUrl || '/vault';
            console.log('[Confirm] Redirecting to:', target);
            router.replace(target);
        };

        // 1. Check if session exists immediately
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('[Confirm] Initial session check:', session ? 'Found' : 'None');
            if (session && mounted) {
                finalize(session.user.id);
            }
        });

        // 2. Listen for Auth Changes (Hash -> Session)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[Confirm] Auth change:', event);
            if (event === 'SIGNED_IN' && session && mounted) {
                // Check if we haven't already started finalizing?
                // Actually finalize handles its own logic, but we might want to prevent double-call.
                // For now, it's safe (idempotent-ish).
                finalize(session.user.id);
            }
        });

        // 3. MANUAL HASH RECOVERY
        // If Supabase fails to pick up the hash (race condition), we do it manually.
        if (typeof window !== 'undefined' && window.location.hash) {
            console.log('[Confirm] Hash detected, attempting manual parse...');
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
                console.log('[Confirm] Tokens found in hash. Forcing session...');
                supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                }).then(({ data, error }) => {
                    if (error) {
                        console.error('[Confirm] Manual session set failed:', error);
                    } else if (data.session) {
                        console.log('[Confirm] Manual session set success.');
                        if (mounted) finalize(data.session.user.id);
                    }
                });
            }
        }

        // 4. Status updates for better UX
        const timeout = setTimeout(() => {
            if (mounted) setStatus("Connecting to secure vault...");
        }, 5000);

        return () => {
            mounted = false;
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, [nextUrl, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#E6DED6]">
            <div className="text-center p-8">
                <Loader2 className="animate-spin h-10 w-10 text-[#3D3630] mx-auto mb-4" />
                <h2 className="text-xl font-serif text-[#3D3630] mb-2">Authenticated</h2>
                <p className="text-[#3D3630]/60 text-sm uppercase tracking-widest animate-pulse">
                    {status}
                </p>
            </div>
        </div>
    );
}
