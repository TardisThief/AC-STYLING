"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { requestPasswordReset } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);
        setIsSuccess(false);

        const result = await requestPasswordReset(email);

        if (result.error) {
            setMessage(result.error);
            toast.error(result.error);
        } else {
            setIsSuccess(true);
            setMessage("Check your email for the password reset link.");
            toast.success("Reset link sent!");
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex bg-[#E6DED6]">
            {/* Left Side: Brand Visuals (Identical to Login) */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#3D3630]">
                <div className="absolute inset-0 opacity-40">
                    <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#D4AF37]/20 via-transparent to-transparent animate-pulse delay-1000" />
                </div>
                <div className="relative z-10 p-20 flex flex-col justify-between h-full text-[#E6DED6]">
                    <div>
                        <h2 className="font-serif text-4xl mb-6">AC Styling</h2>
                        <div className="w-12 h-[1px] bg-[#D4AF37]" />
                    </div>
                </div>
            </div>

            {/* Right Side: Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="w-full max-w-md space-y-8"
                >
                    <div className="space-y-2">
                        <a href="/login" className="flex items-center text-[10px] uppercase tracking-widest text-[#3D3630]/60 hover:text-[#3D3630] transition-colors mb-4">
                            <ArrowLeft size={12} className="mr-1" /> Back to Login
                        </a>
                        <h2 className="font-serif text-3xl text-[#3D3630]">Reset Password</h2>
                        <p className="text-sm text-[#3D3630]/60">Enter your email to receive a password reset link.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
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

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#3D3630] text-[#E6DED6] py-4 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-[#3D3630]/90 transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : (
                                <>
                                    <span>Send Reset Link</span>
                                    <Mail size={16} className="opacity-60" />
                                </>
                            )}
                        </button>
                    </form>

                    {message && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className={`p-4 rounded-sm text-center text-sm ${isSuccess ? 'bg-[#D4AF37]/10 text-[#3D3630]' : 'bg-red-50 text-red-600'}`}
                        >
                            {message}
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
