"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { Mail, Loader2 } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // Redirect to the vault after login
                emailRedirectTo: `${location.origin}/auth/callback`,
            },
        });

        if (error) {
            setMessage("Error: " + error.message);
        } else {
            setMessage("Check your email for the magic link!");
        }
        setIsLoading(false);
    };

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${location.origin}/auth/callback`,
            },
        });
        if (error) setMessage(error.message);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-ac-sand px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-md bg-white/80 backdrop-blur-md p-8 md:p-12 rounded-sm shadow-xl border border-white/40"
            >
                <div className="text-center mb-8">
                    <h1 className="font-serif text-3xl text-ac-taupe mb-2">My Vault</h1>
                    <p className="text-ac-coffee text-sm uppercase tracking-widest">Sign in to your dashboard</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
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
                        className="w-full bg-ac-taupe text-white py-3 px-6 font-bold uppercase tracking-widest text-xs hover:bg-ac-taupe/90 transition-colors flex items-center justify-center gap-2 group"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <>
                                <span>Send Magic Link</span>
                                <Mail size={16} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-ac-taupe/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white/80 px-2 text-ac-taupe/50">Or continue with</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full border border-ac-taupe/20 py-3 px-6 font-bold text-ac-taupe text-xs uppercase tracking-widest hover:border-ac-taupe/50 hover:bg-white transition-colors flex items-center justify-center gap-2"
                    >
                        {/* Simple Google G Icon */}
                        <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 19">
                            <path fillRule="evenodd" d="M8.842 18.083a8.8 8.8 0 0 1-8.65-8.948 8.841 8.841 0 0 1 8.8-8.652h.153a8.464 8.464 0 0 1 5.7 2.257l-2.193 2.038A5.27 5.27 0 0 0 9.09 3.4a5.882 5.882 0 0 0-.2 11.76h.124a5.091 5.091 0 0 0 5.248-4.057L14.3 11H9V8h8.34c.066.543.095 1.09.088 1.636-.086 5.053-3.46 8.449-8.4 8.449l-.186-.002Z" clipRule="evenodd" />
                        </svg>
                        Google
                    </button>
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
