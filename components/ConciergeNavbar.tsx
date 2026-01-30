"use client";

import { Link } from "@/i18n/routing";
import { User } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

export default function ConciergeNavbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md py-4 shadow-sm text-ac-taupe">
            <div className="container mx-auto px-6 md:px-12 flex justify-between items-center">
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
                        AC Styling Lab
                    </span>
                </Link>

                {/* Right Side Actions */}
                <div className="flex items-center space-x-6 md:space-x-8">
                    <LanguageSwitcher isScrolled={true} />

                    <Link href="/vault/profile" className="flex items-center gap-2 text-sm uppercase tracking-widest hover:text-ac-gold transition-colors duration-300">
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
