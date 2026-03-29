"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Catalogs from "./Catalogs";

export default function Services() {
    const t = useTranslations('Services');

    const services = [
        {
            id: 1,
            title: t('personal_stylist.title'),
            description: t('personal_stylist.description')
        },
        {
            id: 2,
            title: t('personal_shopping.title'),
            description: t('personal_shopping.description')
        },
        {
            id: 3,
            title: t('closet_detox.title'),
            description: t('closet_detox.description')
        },
        {
            id: 4,
            title: t('corporate_consulting.title'),
            description: t('corporate_consulting.description')
        },
    ];

    return (
        <section className="w-full bg-ac-taupe py-8 md:py-12 scroll-mt-28" id="services">
            <div className="container mx-auto px-4">

                {/* Header */}
                <div className="flex flex-col items-center text-center mb-8">
                    <span className="font-serif italic text-ac-beige text-xl mb-4">{t('section_title')}</span>
                    <h2 className="font-serif text-3xl md:text-5xl text-ac-sand mb-6">{t('headline')}</h2>
                    <div className="w-12 h-px bg-ac-sand/20"></div>
                </div>

                {/* Service Grid - Clean & Minimal */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
                    {services.map((service, index) => (
                        <motion.a
                            key={service.id}
                            href="/book"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            viewport={{ once: true }}
                            className="group flex flex-col p-6 md:p-8 bg-white/80 backdrop-blur-md border border-white/40 shadow-sm transition-all duration-300 hover:bg-white/90 hover:shadow-lg hover:-translate-y-1 rounded-xl"
                        >
                            <h3 className="font-serif text-2xl text-ac-taupe mb-4 group-hover:text-ac-olive-dark transition-colors">
                                {service.title}
                            </h3>
                            <p className="font-sans text-ac-taupe/70 leading-relaxed text-sm md:text-base mb-6 flex-grow">
                                {service.description}
                            </p>
                            <span className="text-xs uppercase tracking-widest text-ac-taupe group-hover:underline decoration-ac-olive-dark underline-offset-4 font-semibold">
                                {t('learn_more')}
                            </span>
                        </motion.a>
                    ))}
                </div>

                {/* Catalogs Section - Unified */}
                <Catalogs />
            </div>
        </section>
    );
}
