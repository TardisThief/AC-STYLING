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

    const supabase = createClient();

    useEffect(() => {
        if (token) {
            // Store token in cookie so callback can find it
            document.cookie = `intake_token=${token}; path=/; max-age=3600; SameSite=Lax`;
        }
        if (wardrobeToken) {
            document.cookie = `wardrobe_claim_token=${wardrobeToken}; path=/; max-age=3600; SameSite=Lax`;
        }
    }, [token, wardrobeToken]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        // For Supabase with magic links, signUp and signIn work very similarly
        // If the user doesn't exist, signUp creates them.
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${location.origin}/auth/callback`,
                shouldCreateUser: true,
            },
        });

        if (error) {
            setMessage("Error: " + error.message);
        } else {
            setMessage("Check your email to confirm your account!");
        }
        setIsLoading(false);
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

                    <p className="text-center text-[10px] text-ac-taupe/40 uppercase tracking-widest mt-4">
                        Already have an account? <a href="/login" className="text-ac-taupe font-bold hover:text-ac-gold transition-colors">Sign In</a>
                    </p>
                </form>

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
