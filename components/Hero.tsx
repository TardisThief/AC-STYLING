"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { useTranslations } from "next-intl";

export default function Hero() {
    const t = useTranslations('Hero');
    const reduce = useReducedMotion();

    // Orchestrated entrance: each line arrives in sequence rather than the
    // whole block fading up at once. Reduced motion → crossfade only (no travel).
    const container: Variants = {
        hidden: {},
        show: { transition: { staggerChildren: reduce ? 0 : 0.14, delayChildren: 0.1 } },
    };
    const item: Variants = {
        hidden: { opacity: 0, y: reduce ? 0 : 24 },
        show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
    };

    return (
        <section className="relative w-full h-screen overflow-hidden bg-black text-white">
            {/* Full-bleed photograph. The two crops are composed differently, so the
                scrim and the copy placement below are tuned per breakpoint. */}
            <div className="absolute inset-0 w-full h-full">
                {/* Mobile: portrait — subject fills the frame, sign top-left, floor at the base. */}
                <div className="block md:hidden w-full h-full relative">
                    <Image src="/ac photo 4.jpeg" alt="Alejandra, personal stylist, seated beneath the AC Styling sign" fill className="object-cover object-center" priority />
                </div>
                {/* Desktop: panoramic — subject sits right, slatted wall open to the left. */}
                <div className="hidden md:block w-full h-full relative">
                    <Image src="/hero-manu.png" alt="Alejandra, personal stylist, seated beneath the AC Styling sign" fill className="object-cover object-center" priority />
                </div>
            </div>

            {/* Scrims tuned to each crop: mobile darkens upward from the floor (copy sits
                low); desktop darkens leftward across the empty wall so the red blazer and
                the AC Styling sign on the right stay vivid instead of washing out. */}
            <div className="absolute inset-0 md:hidden bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
            <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-black/80 via-black/45 to-black/5" />

            {/* Nav scrim: the transparent-header links sit over the bright AC Styling sign,
                where white-on-white is unreadable. Darkens only the top strip. */}
            <div className="absolute inset-x-0 top-0 h-28 md:h-32 bg-gradient-to-b from-black/65 via-black/30 to-transparent" />

            {/* Copy: bottom-anchored on mobile (over the floor), left-anchored on desktop
                (into the negative space the photograph leaves). */}
            <div className="relative z-10 container mx-auto px-6 md:px-12 h-full flex flex-col justify-end pb-24 md:justify-center md:pb-0">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col items-start text-left max-w-xl"
                >
                    <motion.p variants={item} className="font-sans text-xs md:text-sm uppercase tracking-[0.3em] mb-5 text-white/90">
                        {t('label')}
                    </motion.p>

                    <motion.h1
                        variants={item}
                        className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.02] mb-5 text-white text-balance"
                        style={{ fontFamily: 'var(--font-didot), serif' }}
                    >
                        {t('headline')} <br />
                        <span className="italic">{t('headline_accent')}</span>
                    </motion.h1>

                    <motion.p variants={item} className="font-sans text-base md:text-lg text-white/90 max-w-md leading-relaxed mb-8 font-light text-pretty">
                        {t('subheadline')}
                    </motion.p>

                    <motion.div variants={item}>
                        <Link
                            href="/book"
                            className="inline-block px-10 py-4 border border-white text-white font-sans text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black transition-all duration-300"
                        >
                            {t('cta')}
                        </Link>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
