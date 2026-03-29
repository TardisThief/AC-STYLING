"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";


export default function Navbar() {
    const t = useTranslations('Navbar');
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        // Check initial scroll position safely after mount
        handleScroll();

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { name: t('about'), href: "#about" },
        { name: t('services'), href: "#services" },
        { name: t('contact'), href: "#contact" },
    ];

    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        const element = document.querySelector(href);
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
            setIsMobileMenuOpen(false);
        }
    };

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                    isScrolled
                        ? "bg-white/95 backdrop-blur-md py-4 shadow-sm text-ac-taupe"
                        : "bg-transparent py-6 text-white"
                )}
            >
                <div className="container mx-auto px-6 md:px-12 flex justify-between items-center relative">
                    {/* Logo */}
                    <Link href="/" className="z-50 relative group flex items-center gap-4">
                        <div
                            className={`h-12 w-12 transition-all duration-300 ${isScrolled ? 'bg-ac-taupe' : 'bg-white'}`}
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
                        <span className={`font-serif text-xl font-bold tracking-widest uppercase transition-colors duration-300 ${isScrolled ? 'text-ac-taupe' : 'text-white'}`}>
                            AC Styling
                        </span>
                    </Link>

                    {/* Center Button - Desktop & Tablet - REMOVED */}
                    {/* <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 hidden md:block">
                        <Link
                            href="/vault"
                            className={cn(
                                "font-serif text-lg tracking-wider transition-colors duration-300 border-b-transparent border-b hover:border-current py-1",
                                isScrolled ? "text-ac-taupe border-ac-taupe/20" : "text-white border-white/20"
                            )}
                        >
                            AC Styling Lab
                        </Link>
                    </div> */}

                    {/* Desktop Menu */}
                    <div className="hidden md:flex space-x-8 items-center">
                        {navLinks.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                onClick={(e) => scrollToSection(e, link.href)}
                                className={cn(
                                    "text-sm uppercase tracking-widest transition-colors duration-300",
                                    isScrolled ? "hover:text-ac-beige" : "hover:text-gray-300"
                                )}
                            >
                                {link.name}
                            </a>
                        ))}
                        <div className="z-50 relative">

                            <LanguageSwitcher isScrolled={isScrolled} />
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden z-50 relative focus:outline-none"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? (
                            <X size={28} className={cn(isMobileMenuOpen ? "text-ac-sand" : "text-white")} />
                        ) : (
                            <Menu size={28} />
                        )}
                    </button>
                </div>
            </motion.nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-ac-taupe z-40 flex flex-col justify-center items-center"
                    >
                        <div className="flex flex-col space-y-8 text-center text-ac-sand">
                            {navLinks.map((link, index) => (
                                <motion.a
                                    key={link.name}
                                    href={link.href}
                                    onClick={(e) => scrollToSection(e, link.href)}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 * index, duration: 0.5 }}
                                    className="font-serif text-4xl hover:text-ac-beige transition-colors"
                                >
                                    {link.name}
                                </motion.a>
                            ))}
                            {/* <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * navLinks.length, duration: 0.5 }}
                            >
                                <Link
                                    href="/vault"
                                    className="font-serif text-4xl hover:text-ac-beige transition-colors italic"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    AC Styling Lab
                                </Link>
                            </motion.div> */}
                            <div className="pt-8">
                                <LanguageSwitcher isScrolled={false} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
