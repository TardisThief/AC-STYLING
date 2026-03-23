"use client";

import { Link } from "@/i18n/routing";
import { User } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import UserNotifications from "./UserNotifications";

export default function ConciergeNavbar({ isGuest, isAdmin }: { isGuest?: boolean; isAdmin?: boolean }) {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md py-4 shadow-sm text-ac-taupe">
            <div className="container mx-auto px-6 md:px-12 flex justify-between items-center relative">
                {/* Logo */}
                <Link href="/vault" className="flex items-center gap-4 group">
                    <div
                        className="h-10 w-10 bg-ac-taupe transition-all duration-300"
                        style={{
                            maskImage: "url('/logo.png')",
                            WebkitMaskImage: "url('/logo.png')",
                            maskSize: "contain",
                            WebkitMaskSize: "contain",
                            maskRepeat: "no-repeat",
                            WebkitMaskRepeat: "no-repeat",
                            maskPosition: "center",
                            WebkitMaskPosition: "center"
                        }}
                    />
                    <span className="font-serif text-lg font-bold tracking-widest uppercase text-ac-taupe">
                        <span className="md:hidden">AC</span>
                        <span className="hidden md:inline">AC Styling Lab</span>
                    </span>
                </Link>

                {/* Admin Quick Link */}
                {isAdmin && (
                    <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
                        <Link
                            href="/vault/admin"
                            className="flex items-center gap-2 text-sm uppercase tracking-widest font-medium border border-ac-taupe/20 rounded-full px-5 py-2 hover:border-ac-gold hover:text-ac-gold transition-colors duration-300"
                        >
                            Admin Panel
                        </Link>
                    </div>
                )}

                {/* Right Side Actions */}
                <div className="flex items-center space-x-4 md:space-x-6">
                    <UserNotifications />

                    <div className="h-4 w-px bg-ac-taupe/10 hidden md:block"></div>

                    <LanguageSwitcher isScrolled={true} />

                    <Link
                        href={isGuest ? "/vault/join" : "/vault/profile"}
                        className="flex items-center gap-2 text-sm uppercase tracking-widest hover:text-ac-gold transition-colors duration-300"
                    >
                        <span className="hidden md:inline">Profile</span>
                        <div className="p-2 border border-ac-taupe/20 rounded-full hover:border-ac-gold transition-colors">
                            <User size={18} />
                        </div>
                    </Link>
                </div>
            </div>
        </nav>
    );
}
