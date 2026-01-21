"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export default function Catalogs() {
    const t = useTranslations('Catalogs');

    const catalogs = [
        { name: t('online'), file: "/catalogs/online-services_compressed.pdf" },
        { name: t('in_person'), file: "/catalogs/in-person-services_compressed.pdf" },
        { name: t('corporate'), file: "/catalogs/corporate.pdf" },
    ];

    return (
        <section className="w-full py-20 bg-ac-sand/20 text-ac-taupe">
            <div className="container mx-auto px-6 md:px-12 text-center">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="font-serif text-3xl md:text-4xl mb-12"
                >
                    {t('title')}
                </motion.h2>

                <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-12">
                    {catalogs.map((catalog, index) => (
                        <motion.a
                            key={index}
                            href={catalog.file}
                            target="_blank"
                            rel="noopener noreferrer" // Good practice for security when opening new tabs
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="px-8 py-4 min-w-[240px] border border-ac-taupe rounded text-ac-taupe text-sm uppercase tracking-widest hover:bg-ac-taupe hover:text-ac-sand transition-colors duration-300 flex justify-center items-center bg-transparent"
                        >
                            {catalog.name}
                        </motion.a>
                    ))}
                </div>
            </div>
        </section>
    );
}
