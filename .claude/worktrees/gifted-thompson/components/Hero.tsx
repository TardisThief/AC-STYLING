"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";


export default function Hero() {
    const t = useTranslations('Hero');

    return (
        <section className="relative w-full h-screen overflow-hidden bg-black text-white">
            {/* Background Image */}
            {/* Background Image */}
            <div className="absolute inset-0 w-full h-full">
                {/* Mobile Background: AC Photo 4 */}
                <div className="block md:hidden w-full h-full relative">
                    <Image
                        src="/ac photo 4.jpeg"
                        alt="The AC Style - Mobile"
                        fill
                        className="object-cover object-center"
                        priority
                    />
                </div>

                {/* Desktop Background: Hero Manu */}
                <div className="hidden md:block w-full h-full relative">
                    <Image
                        src="/hero-manu.png"
                        alt="The AC Style - Refined Elegance"
                        fill
                        className="object-cover object-center"
                        priority
                    />
                </div>
            </div>

            {/* Dark Overlay - Critical for Contrast */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Content Container - Centered */}
            <div className="relative z-10 container mx-auto px-4 h-full flex flex-col justify-center items-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.0, ease: "easeOut" }}
                    className="max-w-4xl flex flex-col items-center"
                >
                    {/* Small Uppercase Label */}
                    <p className="font-sans text-xs md:text-sm uppercase tracking-[0.3em] mb-6 text-white/90">
                        {t('label')}
                    </p>

                    {/* Main Headline */}
                    <h1
                        className="font-serif text-3xl md:text-6xl lg:text-7xl leading-none mb-4 text-white"
                        style={{ fontFamily: 'var(--font-didot), serif' }}
                    >
                        {t('headline')} <br />
                        <span className="italic">{t('headline_accent')}</span>
                    </h1>

                    {/* Subheadline */}
                    <p className="font-sans text-base md:text-lg text-white/90 max-w-xl leading-relaxed mb-6 font-light">
                        {t('subheadline')}
                    </p>

                    {/* Button - Transparent with Border */}
                    <a
                        href="/book"
                        className="inline-block px-10 py-4 border border-white text-white font-sans text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all duration-300"
                    >
                        {t('cta')}
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
