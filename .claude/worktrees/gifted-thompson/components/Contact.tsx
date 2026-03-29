"use client";

import { motion } from "framer-motion";
import { Instagram } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const TikTokIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
        className={className}
    >
        <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" />
    </svg>
);

export default function Contact() {
    const t = useTranslations('Contact');

    return (
        <section id="contact" className="w-full flex flex-col md:flex-row min-h-[450px] scroll-mt-28">
            {/* Left: Editorial Image */}
            <div className="w-full md:w-1/2 relative min-h-[400px] md:min-h-full">
                <div className="absolute inset-0 bg-ac-taupe/20 z-10" />
                <img
                    src="/ac-photo-5.jpeg"
                    alt="AC Styling Editorial"
                    className="w-full h-full object-cover object-top"
                />
            </div>

            {/* Right: Contact Content */}
            <div className="w-full md:w-1/2 bg-ac-taupe text-ac-sand flex flex-col justify-center items-center p-6 md:p-12 relative">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    className="max-w-md text-center z-10"
                >
                    <span className="uppercase tracking-[0.2em] text-sm text-ac-beige mb-6 block">
                        {t('label')}
                    </span>
                    <h2 className="font-serif text-4xl md:text-5xl mb-8">
                        {t('title')}
                    </h2>

                    <p className="font-light text-lg leading-relaxed mb-10 text-ac-sand/80">
                        {t('description')}
                    </p>

                    <a
                        href="/book"
                        className="inline-block px-8 py-3 border border-ac-sand text-ac-sand font-sans text-xs uppercase tracking-[0.2em] hover:bg-ac-sand hover:text-ac-taupe transition-all duration-300 mb-12"
                    >
                        {t('cta')}
                    </a>

                    <div className="flex flex-col items-center space-y-6">
                        <a
                            href="mailto:hello@theacstyle.com"
                            className="font-serif text-xl border-b border-ac-sand/20 pb-1 hover:text-ac-beige hover:border-ac-beige transition-all duration-300"
                        >
                            hello@theacstyle.com
                        </a>

                        <div className="flex justify-center space-x-6">
                            <a
                                href="https://www.instagram.com/ac.stylingcoach/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3 border border-ac-sand/20 rounded-full hover:bg-ac-sand hover:text-ac-taupe transition-all duration-300"
                            >
                                <Instagram size={20} />
                            </a>
                            <a
                                href="https://www.tiktok.com/@ac.styling"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3 border border-ac-sand/20 rounded-full hover:bg-ac-sand hover:text-ac-taupe transition-all duration-300"
                            >
                                <TikTokIcon size={20} />
                            </a>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
