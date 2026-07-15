"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import Catalogs from "./Catalogs";

export default function Services() {
    const t = useTranslations('Services');

    const services = [
        { id: 1, title: t('personal_stylist.title'), description: t('personal_stylist.description') },
        { id: 2, title: t('personal_shopping.title'), description: t('personal_shopping.description') },
        { id: 3, title: t('closet_detox.title'), description: t('closet_detox.description') },
        { id: 4, title: t('corporate_consulting.title'), description: t('corporate_consulting.description') },
    ];

    return (
        <section className="w-full bg-ac-taupe py-16 md:py-28 scroll-mt-28" id="services">
            <div className="container mx-auto px-4">

                {/* Header */}
                <div className="max-w-5xl mx-auto mb-10 md:mb-16">
                    <span className="block font-serif italic text-ac-beige text-xl md:text-2xl mb-3">
                        {t('section_title')}
                    </span>
                    <h2 className="font-serif text-4xl md:text-6xl text-ac-sand leading-[1.05] text-balance max-w-3xl">
                        {t('headline')}
                    </h2>
                </div>

                {/* Editorial service index — full-width typographic rows, not cards */}
                <div className="max-w-5xl mx-auto border-t border-ac-sand/15">
                    {services.map((service, index) => (
                        <motion.a
                            key={service.id}
                            href="/book"
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            viewport={{ once: true, margin: "-60px" }}
                            className="group grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-8 items-baseline border-b border-ac-sand/15 py-7 md:py-9 transition-colors duration-500 hover:bg-ac-sand/[0.04] focus-visible:bg-ac-sand/[0.06] focus-visible:outline-none px-2 -mx-2"
                        >
                            <h3 className="md:col-span-5 font-serif text-2xl md:text-4xl text-ac-sand leading-tight transition-colors duration-300 group-hover:text-ac-beige flex items-start gap-3">
                                <span className="flex-1">{service.title}</span>
                                <ArrowUpRight
                                    className="shrink-0 mt-1 text-ac-beige opacity-0 -translate-x-2 translate-y-1 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 md:hidden"
                                    size={22}
                                    aria-hidden="true"
                                />
                            </h3>

                            <p className="md:col-span-6 font-sans text-ac-sand/80 leading-relaxed text-sm md:text-base max-w-xl">
                                {service.description}
                            </p>

                            <div className="hidden md:flex md:col-span-1 justify-end self-center">
                                <ArrowUpRight
                                    className="text-ac-beige opacity-40 -translate-x-1 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:translate-x-0"
                                    size={26}
                                    aria-hidden="true"
                                />
                            </div>
                        </motion.a>
                    ))}
                </div>

                {/* Catalogs Section - Unified */}
                <Catalogs />
            </div>
        </section>
    );
}
