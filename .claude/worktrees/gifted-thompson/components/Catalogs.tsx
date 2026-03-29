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
        <div className="w-full mt-8 md:mt-12 text-ac-sand">
            <div className="text-center">
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
                            className="px-8 py-4 min-w-[240px] border border-ac-sand rounded text-ac-sand text-sm uppercase tracking-widest hover:bg-ac-sand hover:text-ac-taupe transition-colors duration-300 flex justify-center items-center bg-transparent"
                        >
                            {catalog.name}
                        </motion.a>
                    ))}
                </div>
            </div>
        </div>
    );
}
