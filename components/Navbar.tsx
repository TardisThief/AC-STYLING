"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";


export type NavLink = { name: string; href: string };

/**
 * `links` replaces the landing page's About / Services / Contact with the
 * sections of the page the navbar sits on. Each href must be an in-page
 * anchor (`#id`) that exists on that page. Without it, a page that is not the
 * landing page gets links to sections it doesn't have.
 */
export default function Navbar({ links, menuLabel }: { links?: NavLink[]; menuLabel?: string } = {}) {
    const t = useTranslations('Navbar');
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    /**
     * Keyboard behaviour for the mobile menu.
     *
     * The overlay covers the entire viewport, so while it is open it is modal
     * whether or not it is called a dialog. It previously had none of what
     * that implies: Escape did nothing, Tab walked off into the page behind
     * it, and closing the menu dropped focus back to the top of the document.
     * Someone navigating by keyboard could open it and not get out.
     *
     * `components/ui/Modal` already solves this for dialogs, but it renders a
     * centred panel with its own chrome, which is not what a full-screen nav
     * overlay is — so the same three behaviours are implemented here rather
     * than bending that component out of shape.
     */
    useEffect(() => {
        if (!isMobileMenuOpen) return;

        // No visibility filter on purpose. The overlay only renders its own
        // controls and only while it is open, so there is nothing hidden to
        // skip — and an `offsetParent` check would depend on layout, which
        // makes the behaviour untestable outside a real browser for no gain.
        const focusable = () =>
            Array.from(
                panelRef.current?.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
                ) ?? []
            );

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMobileMenuOpen(false);
                return;
            }

            if (event.key !== 'Tab') return;

            // Keep Tab inside the overlay: wrap at both ends rather than
            // letting focus escape to the page underneath.
            const items = focusable();
            if (items.length === 0) return;

            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        // Move focus in, so the first Tab lands inside rather than behind.
        focusable()[0]?.focus();

        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isMobileMenuOpen]);

    /**
     * Send focus back to the toggle after the menu closes.
     *
     * Deliberately its own effect rather than the cleanup above: cleanup runs
     * before React has committed the closed state, so focusing there lands on
     * an element that is about to re-render and the focus is lost — the menu
     * closes and focus falls to the top of the document, which is the thing
     * being fixed.
     */
    const wasMenuOpen = useRef(false);
    useEffect(() => {
        if (wasMenuOpen.current && !isMobileMenuOpen) {
            toggleRef.current?.focus();
        }
        wasMenuOpen.current = isMobileMenuOpen;
    }, [isMobileMenuOpen]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        // Check initial scroll position safely after mount
        handleScroll();

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = links ?? [
        { name: t('about'), href: "#about" },
        { name: t('services'), href: "#services" },
        { name: t('contact'), href: "#contact" },
    ];

    // Five section links don't fit beside the logo at tablet width (the logo
    // and labels wrap and the language switch is cut off), so a longer menu
    // keeps the burger up to `lg`. Full class names, so Tailwind can see them.
    const wide = navLinks.length > 3;

    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
        // Close either way: a missing target used to leave the full-screen
        // menu open with nothing happening.
        setIsMobileMenuOpen(false);
    };

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn(
                    // z-nav (30), not a hardcoded z-50. globals.css defines the
                    // scale -- dropdown 10, sticky 20, nav 30, modal 40, toast
                    // 50 -- and the bar was sitting above all of it, so a dialog
                    // opened anywhere on the site had its heading and its close
                    // button painted over by the navbar on a short screen. The
                    // z-50 and z-40 below are scoped to this element's own
                    // stacking context, so the menu overlay and its toggle keep
                    // their order relative to each other.
                    "fixed top-0 left-0 right-0 z-nav transition-all duration-300",
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
                    <div className={cn("hidden space-x-8 items-center", wide ? "lg:flex" : "md:flex")}>
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
                        type="button"
                        ref={toggleRef}
                        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={isMobileMenuOpen}
                        className={cn("z-50 relative focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-olive", wide ? "lg:hidden" : "md:hidden")}
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
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={menuLabel ?? t('menuLabel')}
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
