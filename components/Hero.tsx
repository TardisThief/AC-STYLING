"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";


export default function Hero() {
    const t = useTranslations('Hero');

    return (
        <section className="relative w-full h-screen overflow-hidden bg-black text-white">
            {/* Background Image */}
            <div className="absolute inset-0 w-full h-full">
                <Image
                    src="/hero-manu.png"
                    alt="The AC Style - Refined Elegance"
                    fill
                    className="object-cover object-center"
                    priority
                />
            </div>

            {/* Dark Overlay - Critical for Contrast */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Content Container - Centered */}
            <div className="relative z-10 container mx-auto px-6 h-full flex flex-col justify-center items-center text-center">
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
                        className="font-serif text-5xl md:text-7xl lg:text-8xl leading-none mb-8 text-white"
                        style={{ fontFamily: 'var(--font-didot), serif' }}
                    >
                        {t('headline')} <br />
                        <span className="italic">{t('headline_accent')}</span>
                    </h1>

                    {/* Subheadline */}
                    <p className="font-sans text-base md:text-lg text-white/90 max-w-xl leading-relaxed mb-10 font-light">
                        {t('subheadline')}
                    </p>

                    {/* Button - Transparent with Border */}
                    <a
                        href="https://calendly.com/ridarcos/30min"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-10 py-4 border border-white text-white font-sans text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all duration-300"
                    >
                        {t('cta')}
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
