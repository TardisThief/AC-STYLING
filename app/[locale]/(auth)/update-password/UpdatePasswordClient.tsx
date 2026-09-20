"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { Loader2, Lock, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setIsLoading(true);

        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            toast.error(error.message);
        } else {
            toast.success("Password updated successfully!");
            setTimeout(() => {
                router.push("/vault");
            }, 1000);
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex bg-[#E6DED6]">
            {/* Left Side: Brand Visuals */}
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
                        <h2 className="font-serif text-3xl text-[#3D3630]">Set New Password</h2>
                        <p className="text-sm text-[#3D3630]/60">Secure your account with a new password.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-widest text-[#3D3630]/40">
                                    New Password
                                </label>
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

                            <div className="space-y-2">
                                <label htmlFor="confirmPassword" className="block text-[10px] font-bold uppercase tracking-widest text-[#3D3630]/40">
                                    Confirm Password
                                </label>
                                <div className="relative group">
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        className="w-full bg-white/50 border border-[#3D3630]/10 rounded-sm px-4 py-4 text-[#3D3630] placeholder:text-[#3D3630]/20 focus:outline-none focus:border-[#D4AF37] focus:bg-white transition-all font-serif"
                                    />
                                </div>
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
                                    <span>Update Password</span>
                                    <CheckCircle size={16} className="opacity-60" />
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
