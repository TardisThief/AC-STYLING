"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Lock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import IntakeUploader from "./IntakeUploader";
import { User } from "@supabase/supabase-js";
import { activateStudioAccess } from "@/app/actions/studio";
import { toast } from "sonner";

interface IntakeLandingProps {
    token: string;
    clientName: string;
    locale: string;
    user: User | null;
}

export default function IntakeLanding({ token, clientName, locale, user }: IntakeLandingProps) {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);

    // Effect: If User is logged in, validate token and unlock studio
    useEffect(() => {
        let mounted = true;

        const unlockStudio = async () => {
            if (!user) return;
            setIsChecking(true);
            try {
                const result = await activateStudioAccess(token);
                if (mounted) {
                    if (result.success) {
                        setIsAuthorized(true);
                        toast.success("Studio Access Unlocked");
                    } else {
                        // If token is invalid or claimed by another, we might need a specific error UI
                        // But for now, just toast error.
                        toast.error(result.error || "Failed to activate studio access.");
                    }
                }
            } catch (err) {
                console.error(err);
                if (mounted) toast.error("An unexpected error occurred.");
            } finally {
                if (mounted) setIsChecking(false);
            }
        };

        if (user) {
            unlockStudio();
        }
    }, [user, token]);

    // Handler for Login Navigation
    const handleLoginRedirect = (mode: 'login' | 'signup') => {
        // Enforce returning to this page after auth
        // We pass 'wardrobe' AND 'token' params. 'wardrobe' triggers claim, 'token' triggers profile migration.
        const next = encodeURIComponent(window.location.pathname);
        router.push(`/${locale}/${mode}?token=${token}&wardrobe=${token}&next=${next}`);
    };

    return (
        <div className="w-full max-w-xl mx-auto relative min-h-[60vh] flex flex-col justify-center">
            <AnimatePresence mode="wait">
                {/* STATE: CHECKING (Loading) */}
                {isChecking && (
                    <motion.div
                        key="checking"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-20"
                    >
                        <Loader2 className="animate-spin text-ac-gold mx-auto mb-4" size={40} />
                        <p className="text-ac-taupe/60 text-xs font-bold uppercase tracking-widest animate-pulse">
                            Verifying Invitation...
                        </p>
                    </motion.div>
                )}

                {/* STATE: UNAUTHENTICATED (Require Login/Signup) */}
                {!user && !isChecking && (
                    <motion.div
                        key="portal"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white/30 backdrop-blur-xl border border-white/40 p-10 md:p-14 rounded-sm shadow-2xl text-center"
                    >
                        <div className="inline-block p-4 bg-ac-gold/10 rounded-full mb-6">
                            <Sparkles className="text-ac-gold" size={32} />
                        </div>

                        <h1 className="font-serif text-3xl md:text-4xl text-ac-taupe mb-3">
                            Welcome, {clientName}.
                        </h1>
                        <p className="font-sans text-ac-taupe/70 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
                            To ensure the security of your wardrobe and access your private studio vault, please create an account or sign in to begin.
                        </p>

                        <div className="space-y-3 max-w-xs mx-auto">
                            <button
                                onClick={() => handleLoginRedirect('signup')}
                                className="w-full bg-ac-taupe text-white py-3.5 rounded-sm hover:bg-ac-taupe/90 transition-all uppercase tracking-widest text-xs font-bold flex justify-center gap-2 items-center shadow-lg"
                            >
                                <span>Join the Studio</span>
                                <ArrowRight size={14} />
                            </button>
                            <button
                                onClick={() => handleLoginRedirect('login')}
                                className="w-full bg-white/50 text-ac-taupe border border-ac-taupe/20 py-3.5 rounded-sm hover:bg-white hover:border-ac-taupe/40 transition-all uppercase tracking-widest text-xs font-bold"
                            >
                                Member Login
                            </button>
                        </div>

                        <div className="mt-8 flex items-center justify-center gap-2 text-ac-taupe/40 text-[10px] uppercase tracking-widest">
                            <Lock size={12} />
                            <span>Secure Studio Access</span>
                        </div>
                    </motion.div>
                )}

                {/* STATE: AUTHORIZED (Uploader) */}
                {user && isAuthorized && !isChecking && (
                    <motion.div
                        key="uploader"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full"
                    >
                        <div className="mb-8 text-center">
                            <p className="text-ac-gold text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                <Sparkles size={12} /> Studio Access Active
                            </p>
                            <h2 className="font-serif text-3xl text-ac-taupe">
                                Upload Your Wardrobe
                            </h2>
                        </div>

                        <IntakeUploader
                            token={token}
                            isGuest={false}
                            locale={locale}
                            onUploadSuccess={() => {
                                toast.success("Assets Received. Redirecting to Vault...");
                                router.push(`/${locale}/vault`);
                            }}
                        />
                    </motion.div>
                )}

                {/* STATE: UNAUTHORIZED / ERROR (Token Failed/Expired) */}
                {user && !isAuthorized && !isChecking && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white/30 p-10 rounded-sm text-center border border-red-200/50"
                    >
                        <p className="text-red-500 font-bold mb-4">Access Issue</p>
                        <p className="text-sm text-ac-taupe/70 mb-6">
                            We couldn't activate access with this link. It may be expired or already claimed.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-ac-taupe text-white px-6 py-2 rounded-sm text-xs uppercase font-bold tracking-widest"
                        >
                            Retry
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
