"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Camera, UserPlus, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import IntakeUploader from "./IntakeUploader";

// ... imports
import { User } from "@supabase/supabase-js"; // Add import

interface IntakeLandingProps {
    token: string;
    clientName: string;
    locale: string;
    user: User | null;
}

export default function IntakeLanding({ token, clientName, locale, user }: IntakeLandingProps) {
    // Default to 'upload' so guests can interact immediately.
    const [step, setStep] = useState<'upload' | 'signup'>('upload');

    return (
        <div className="w-full max-w-xl mx-auto relative">
            <AnimatePresence mode="wait">
                {step === 'upload' ? (
                    <motion.div
                        key="uploader"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="w-full"
                    >
                        {/* Header for Guest Context */}
                        {
                            !user && (
                                <div className="mb-6 text-center">
                                    <h1 className="font-serif text-3xl md:text-5xl text-ac-taupe mb-2">
                                        Welcome, {clientName}.
                                    </h1>
                                    <p className="font-sans text-ac-taupe/70 text-xs font-bold uppercase tracking-widest">
                                        Upload your wardrobe to begin
                                    </p>
                                </div>
                            )
                        }

                        <IntakeUploader
                            token={token}
                            isGuest={!user}
                            locale={locale}
                            onUploadSuccess={() => setStep('signup')}
                        />
                    </motion.div >
                ) : (
                    <motion.div
                        key="signup"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/30 backdrop-blur-xl border border-white/40 p-10 md:p-16 rounded-sm shadow-2xl text-center"
                    >
                        {/* Header Content */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="inline-block p-3 bg-ac-gold/10 rounded-full mb-8"
                        >
                            <Sparkles className="text-ac-gold" size={32} />
                        </motion.div>

                        <h2 className="font-serif text-3xl text-ac-taupe mb-4 leading-tight">
                            Assets Received.
                        </h2>

                        <p className="font-sans text-ac-taupe/70 mb-8 tracking-wide uppercase text-xs font-bold">
                            Secure your vault to save your digital wardrobe.
                        </p>

                        <SignupForm
                            defaultName={clientName}
                            token={token}
                            onComplete={() => {
                                window.location.reload();
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence >
        </div >
    );
}

// Inline Signup Form Component for Simplicity
import { signUpSeamless } from "@/app/actions/auth";
import { toast } from "sonner";
import { useTransition, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

function SignupForm({ onComplete, defaultName, token }: { onComplete: () => void, defaultName: string, token: string }) {
    const [isPending, startTransition] = useTransition();
    const supabase = createClient();

    // Ensure cookie is set for OAuth flow so callback can link it
    useEffect(() => {
        if (token) {
            // Set cookie for 1 hour
            document.cookie = `intake_token=${token}; path=/; max-age=3600; SameSite=Lax`;
        }
    }, [token]);

    const handleSubmit = (formData: FormData) => {
        startTransition(async () => {
            // Pass the token to ensure linking happens
            const result = await signUpSeamless(formData, window.location.pathname, token);
            if (result?.error) {
                toast.error(result.error);
            }
        });
    };

    const handleGoogleSignup = async () => {
        const next = window.location.pathname; // Should be /en/studio/intake/[token]
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });
        if (error) {
            toast.error(error.message);
        }
    };

    return (
        <div className="space-y-6">
            <form action={handleSubmit} className="space-y-4 text-left">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-ac-taupe/60">Full Name</label>
                    <input
                        name="fullName"
                        type="text"
                        required
                        defaultValue={defaultName}
                        className="w-full bg-white/40 border-b border-ac-taupe/20 p-2 text-ac-taupe focus:outline-none focus:border-ac-gold"
                        placeholder="Jane Doe"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-ac-taupe/60">Email</label>
                    <input name="email" type="email" required className="w-full bg-white/40 border-b border-ac-taupe/20 p-2 text-ac-taupe focus:outline-none focus:border-ac-gold" placeholder="jane@example.com" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-ac-taupe/60">Password</label>
                    <input name="password" type="password" required className="w-full bg-white/40 border-b border-ac-taupe/20 p-2 text-ac-taupe focus:outline-none focus:border-ac-gold" placeholder="••••••••" />
                </div>
                <button
                    disabled={isPending}
                    className="w-full bg-ac-taupe text-white py-3 mt-4 hover:bg-ac-taupe/90 transition-all disabled:opacity-50 uppercase tracking-widest text-xs font-bold flex justify-center gap-2"
                >
                    <span>{isPending ? 'Creating Account...' : 'Initialize Studio'}</span>
                    {!isPending && <ArrowRight size={14} />}
                </button>
            </form>

            <div className="text-center mt-4 mb-6">
                <button
                    type="button"
                    onClick={() => {
                        const next = encodeURIComponent(window.location.pathname);
                        window.location.href = `/login?next=${next}`;
                    }}
                    className="text-xs uppercase tracking-widest text-ac-taupe/60 hover:text-ac-gold font-bold transition-colors"
                >
                    Already have an account? <span className="underline decoration-1 underline-offset-4">Log In</span>
                </button>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-ac-taupe/10"></span>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                    <span className="bg-[#fcfbf9] px-2 text-ac-taupe/40">Or continue with</span>
                </div>
            </div>

            <button
                type="button"
                onClick={handleGoogleSignup}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-ac-taupe/10 rounded-sm bg-white/40 hover:bg-white hover:border-ac-taupe/20 transition-all text-ac-taupe text-xs font-bold uppercase tracking-wider"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
            </button>
        </div>
    );
}
