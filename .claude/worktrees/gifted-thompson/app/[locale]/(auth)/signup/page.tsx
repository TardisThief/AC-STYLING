"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { Mail, Loader2, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const wardrobeToken = searchParams.get('wardrobe');
    const nextUrl = searchParams.get('next');

    const supabase = createClient();

    // Build auth callback URL with next parameter AND wardrobe token for email flows
    // (Cookie might not survive if user opens magic link in different browser)
    const callbackParams = new URLSearchParams();
    if (nextUrl) callbackParams.set('next', nextUrl);
    if (wardrobeToken) callbackParams.set('wardrobe_claim', wardrobeToken);
    if (token) callbackParams.set('intake_token', token);

    useEffect(() => {
        if (token) {
            // Store token in cookie so callback can find it
            document.cookie = `intake_token=${token}; path=/; max-age=3600; SameSite=Lax`;
        }
        if (wardrobeToken) {
            document.cookie = `wardrobe_claim_token=${wardrobeToken}; path=/; max-age=3600; SameSite=Lax`;
        }
        if (nextUrl) {
            document.cookie = `auth_next_url=${nextUrl}; path=/; max-age=3600; SameSite=Lax`;
        }
    }, [token, wardrobeToken, nextUrl]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        // Use custom action to ensure Branded Email via Resend
        const { signUpWithMagicLink } = await import('@/app/actions/auth');
        const result = await signUpWithMagicLink(email, nextUrl ?? undefined);

        if (result.error) {
            setMessage("Error: " + result.error);
        } else {
            setMessage("Check your email to confirm your account!");
        }
        setIsLoading(false);
    };

    const handleGoogleSignup = async () => {
        const callbackUrl = callbackParams.toString()
            ? `${window.location.origin}/auth/callback?${callbackParams.toString()}`
            : `${window.location.origin}/auth/callback`;

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: callbackUrl,
            },
        });
        if (error) {
            setMessage("Error: " + error.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-ac-sand px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-md bg-white/80 backdrop-blur-md p-8 md:p-12 rounded-sm shadow-xl border border-white/40"
            >
                <div className="text-center mb-8">
                    <div className="inline-block p-2 bg-ac-gold/10 rounded-full mb-4">
                        <Sparkles className="text-ac-gold" size={24} />
                    </div>
                    <h1 className="font-serif text-3xl text-ac-taupe mb-2">Join the Lab</h1>
                    <p className="text-ac-coffee text-sm uppercase tracking-widest">Create your styling profile</p>
                    {token && (
                        <p className="mt-2 text-[10px] text-ac-gold font-bold uppercase tracking-widest bg-ac-gold/5 py-1 px-3 rounded-full inline-block">
                            Personalized Invite Active
                        </p>
                    )}
                </div>

                <form onSubmit={handleSignup} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-xs font-bold text-ac-taupe/60 uppercase tracking-widest mb-2">
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                            className="w-full bg-white/50 border border-ac-taupe/20 px-4 py-3 text-ac-taupe placeholder:text-ac-taupe/30 focus:outline-none focus:border-ac-gold transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-ac-taupe text-white py-3 px-6 font-bold uppercase tracking-widest text-xs hover:bg-ac-gold transition-colors flex items-center justify-center gap-2 group"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <>
                                <span>Create Account</span>
                                <Mail size={16} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                {/* Separator */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-ac-taupe/10" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                        <span className="bg-white/80 px-4 text-ac-taupe/40">Or</span>
                    </div>
                </div>

                {/* Google OAuth */}
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
                    Continue with Google
                </button>

                <p className="text-center text-[10px] text-ac-taupe/40 uppercase tracking-widest mt-6">
                    Already have an account? <a href="/login" className="text-ac-taupe font-bold hover:text-ac-gold transition-colors">Sign In</a>
                </p>

                {message && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-6 p-4 bg-ac-gold/10 border border-ac-gold/20 text-ac-taupe text-sm text-center"
                    >
                        {message}
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
