"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { Mail, Loader2, User, ChevronRight } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginPage() {
    const [loginMethod, setLoginMethod] = useState<'magic' | 'password'>('magic');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [guestLoading, setGuestLoading] = useState(false);

    // Auth state feedback
    const [message, setMessage] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const wardrobeToken = searchParams.get('wardrobe');
    const nextUrl = searchParams.get('next');
    const errorMsg = searchParams.get('error'); // 'auth_code_error'
    const errorDetails = searchParams.get('details');

    const supabase = createClient();

    // Build auth callback URL with next parameter
    const callbackParams = new URLSearchParams();
    if (nextUrl) callbackParams.set('next', nextUrl);
    if (wardrobeToken) callbackParams.set('wardrobe_claim', wardrobeToken);
    if (token) callbackParams.set('intake_token', token);

    useEffect(() => {
        // 1. Setup Auth Listener for Implicit Flow (Hash) Support
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                // Determine redirect path
                const target = nextUrl || '/vault';
                // Avoid double-toast if we dealt with it in handle functions
                if (!isLoading) {
                    toast.success("Successfully signed in.");
                    router.push(target);
                }
            }
        });

        // 2. Handle Feedback Params
        if (token) {
            document.cookie = `intake_token=${token}; path=/; max-age=3600; SameSite=Lax`;
        }
        if (wardrobeToken) {
            document.cookie = `wardrobe_claim_token=${wardrobeToken}; path=/; max-age=3600; SameSite=Lax`;
        }
        if (nextUrl) {
            document.cookie = `auth_next_url=${nextUrl}; path=/; max-age=3600; SameSite=Lax`;
        }

        // Only show error if NO hash exists (because hash means successful implicit login is pending)
        if (errorMsg) {
            const hasHash = typeof window !== 'undefined' && window.location.hash.includes('access_token');
            if (!hasHash) {
                toast.error(errorDetails ? `Login Failed: ${errorDetails}` : "Authentication failed. Please try again.");
            }
        }

        return () => {
            subscription.unsubscribe();
        };
    }, [token, wardrobeToken, nextUrl, errorMsg, errorDetails, supabase, router, isLoading]);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);
        setIsSuccess(false);

        if (loginMethod === 'magic') {
            // Import and use Server Action for Branded Magic Link
            const { signInWithMagicLink } = await import('@/app/actions/auth');
            const result = await signInWithMagicLink(email, nextUrl ?? undefined);

            if (result.error) {
                setMessage(result.error);
                toast.error(result.error);
            } else {
                setIsSuccess(true);
                setMessage("Check your email for the magic link!");
                toast.success("Magic link sent!");
            }
        } else {
            // Password Login
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setMessage(error.message);
                toast.error(error.message);
            } else {
                toast.success("Welcome back!");
                router.push(nextUrl || '/vault');
            }
        }

        setIsLoading(false);
    };

    const handleGoogleLogin = async () => {
        // Construct callback URL dynamically on the client
        // Construct callback URL dynamically with all params (next, wardrobe)
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
            toast.error(error.message);
        }
    }

    const handleGuestLogin = async () => {
        setGuestLoading(true);

        // Anonymous login
        const { data, error } = await supabase.auth.signInAnonymously();

        if (error) {
            console.error('Guest login failed:', error);
            // Fallback: If anonymous login is disabled in Supabase, show specific error
            if (error.message.includes('Anonymous sign-ins are disabled')) {
                toast.error("Guest access is currently disabled.");
            } else {
                toast.error("Could not sign in as guest.");
            }
        } else {
            toast.success("Welcome, Guest!");
            router.push('/vault');
        }
        setGuestLoading(false);
    };

    return (
        <div className="min-h-screen flex bg-[#E6DED6]">

            {/* Left Side: Brand & Visuals (Hidden on mobile, visible lg) */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#3D3630]">
                {/* Abstract Visual Layer */}
                <div className="absolute inset-0 opacity-40">
                    <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#D4AF37]/20 via-transparent to-transparent animate-pulse delay-1000" />
                </div>

                <div className="relative z-10 p-20 flex flex-col justify-between h-full text-[#E6DED6]">
                    <div>
                        <h2 className="font-serif text-4xl mb-6">AC Styling</h2>
                        <div className="w-12 h-[1px] bg-[#D4AF37]" />
                    </div>

                    <div className="space-y-6 max-w-md">
                        <h1 className="font-serif text-5xl leading-tight">
                            Elevate your personal style journey.
                        </h1>
                        <p className="text-sm uppercase tracking-widest opacity-60">
                            Learning • Styling • Services
                        </p>
                    </div>

                    <div className="text-[10px] uppercase tracking-widest opacity-40">
                        © 2026 AC Styling. All Rights Reserved.
                    </div>
                </div>
            </div>

            {/* Right Side: Auth Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
                {/* Mobile Background Decoration */}
                <div className="lg:hidden absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#D4AF37]/10 rounded-full blur-3xl opacity-50" />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="w-full max-w-md space-y-12"
                >
                    {/* Mobile Header */}
                    <div className="lg:hidden text-center space-y-4">
                        <h2 className="font-serif text-3xl text-[#3D3630]">AC Styling</h2>
                        <p className="text-[10px] uppercase tracking-widest text-[#3D3630]/60">
                            Learning • Styling • Services
                        </p>
                    </div>

                    {/* Intro Text (Desktop) */}
                    <div className="hidden lg:block space-y-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">Welcome Back</p>
                        <h2 className="font-serif text-3xl text-[#3D3630]">Access your Vault</h2>
                    </div>

                    <div className="space-y-6">
                        {/* Toggle Login Method */}
                        <div className="flex bg-[#3D3630]/5 p-1 rounded-sm">
                            <button
                                type="button"
                                onClick={() => setLoginMethod('magic')}
                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-all ${loginMethod === 'magic' ? 'bg-[#3D3630] text-[#E6DED6] shadow-sm' : 'text-[#3D3630]/60 hover:text-[#3D3630]'
                                    }`}
                            >
                                Magic Link
                            </button>
                            <button
                                type="button"
                                onClick={() => setLoginMethod('password')}
                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-all ${loginMethod === 'password' ? 'bg-[#3D3630] text-[#E6DED6] shadow-sm' : 'text-[#3D3630]/60 hover:text-[#3D3630]'
                                    }`}
                            >
                                Password
                            </button>
                        </div>

                        {/* Email Login Form */}
                        <form onSubmit={handleEmailLogin} className="space-y-5">
                            <div className="space-y-2">
                                <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-widest text-[#3D3630]/40">
                                    Email Address
                                </label>
                                <div className="relative group">
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="client@acstyling.com"
                                        className="w-full bg-white/50 border border-[#3D3630]/10 rounded-sm px-4 py-4 text-[#3D3630] placeholder:text-[#3D3630]/20 focus:outline-none focus:border-[#D4AF37] focus:bg-white transition-all font-serif"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            {loginMethod === 'password' && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-widest text-[#3D3630]/40">
                                            Password
                                        </label>
                                        <a href="/forgot-password" className="text-[10px] text-[#3D3630]/60 hover:text-[#3D3630] underline uppercase tracking-widest">
                                            Forgot?
                                        </a>
                                    </div>
                                    <div className="relative group">
                                        <input
                                            id="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            placeholder="••••••••"
                                            className="w-full bg-white/50 border border-[#3D3630]/10 rounded-sm px-4 py-4 text-[#3D3630] placeholder:text-[#3D3630]/20 focus:outline-none focus:border-[#D4AF37] focus:bg-white transition-all font-serif"
                                        />
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-[#3D3630] text-[#E6DED6] py-4 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-[#3D3630]/90 transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <>
                                        <span>{loginMethod === 'magic' ? 'Send Login Link' : 'Sign In'}</span>
                                        {loginMethod === 'magic' ? <Mail size={16} className="opacity-60" /> : <ChevronRight size={16} className="opacity-60" />}
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Success Message */}
                        {message && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className={`p-4 rounded-sm text-center text-sm ${isSuccess ? 'bg-[#D4AF37]/10 text-[#3D3630]' : 'bg-red-50 text-red-600'}`}
                            >
                                {message}
                            </motion.div>
                        )}

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-[#3D3630]/10" />
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                                <span className="bg-[#E6DED6] px-4 text-[#3D3630]/40">Or</span>
                            </div>
                        </div>

                        {/* Secondary Options */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                className="flex items-center justify-center gap-2 px-6 py-3 border border-[#3D3630]/10 rounded-sm bg-white/40 hover:bg-white hover:border-[#3D3630]/20 transition-all text-[#3D3630] text-xs font-bold uppercase tracking-wider"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Google
                            </button>

                            <button
                                type="button"
                                onClick={handleGuestLogin}
                                disabled={guestLoading}
                                className="flex items-center justify-center gap-2 px-6 py-3 border border-[#3D3630]/10 rounded-sm bg-white/40 hover:bg-white hover:border-[#3D3630]/20 transition-all text-[#3D3630] text-xs font-bold uppercase tracking-wider group"
                            >
                                {guestLoading ? (
                                    <Loader2 className="animate-spin" size={14} />
                                ) : (
                                    <>
                                        <span>Guest</span>
                                        <User size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-[10px] text-[#3D3630]/40 leading-relaxed max-w-xs mx-auto">
                        By continuing, you agree to our Terms of Service. <br />
                        New to the Vault? <a href="/vault/join" className="text-[#3D3630] border-b border-[#3D3630]/30 hover:border-[#3D3630] transition-colors pb-0.5">Start your membership</a>
                    </p>
                </motion.div>

                {/* Corner Decoration */}
                <div className="absolute top-8 left-8 lg:hidden">
                    <div className="w-8 h-8 border-t border-l border-[#3D3630]/20" />
                </div>
                <div className="absolute bottom-8 right-8 lg:hidden">
                    <div className="w-8 h-8 border-b border-r border-[#3D3630]/20" />
                </div>
            </div>
        </div>
    );
}
