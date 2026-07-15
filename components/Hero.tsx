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
            {/* Full-bleed photograph */}
            <div className="absolute inset-0 w-full h-full">
                <div className="block md:hidden w-full h-full relative">
                    <Image src="/ac photo 4.jpeg" alt="The AC Style — refined personal styling" fill className="object-cover object-center" priority />
                </div>
                <div className="hidden md:block w-full h-full relative">
                    <Image src="/hero-manu.png" alt="The AC Style — refined personal styling" fill className="object-cover object-center" priority />
                </div>
            </div>

            {/* Bottom-weighted gradient scrim: depth + guaranteed text contrast on any photo */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4 h-full flex flex-col justify-center items-center text-center">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="max-w-4xl flex flex-col items-center"
                >
                    <motion.p variants={item} className="font-sans text-xs md:text-sm uppercase tracking-[0.3em] mb-6 text-white/90">
                        {t('label')}
                    </motion.p>

                    <motion.h1
                        variants={item}
                        className="font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.05] mb-5 text-white text-balance"
                        style={{ fontFamily: 'var(--font-didot), serif' }}
                    >
                        {t('headline')} <br />
                        <span className="italic">{t('headline_accent')}</span>
                    </motion.h1>

                    <motion.p variants={item} className="font-sans text-base md:text-lg text-white/90 max-w-xl leading-relaxed mb-8 font-light text-pretty">
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
