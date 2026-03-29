"use client";

import { motion } from "framer-motion";

import { useTranslations } from "next-intl";
import TestimonialCarousel from "./TestimonialCarousel";

export default function Testimonials() {
    const t = useTranslations('Testimonials');

    const testimonials = [
        {
            name: "Alexandra",
            location: "Toronto",
            text: t('t1.text'),
        },
        {
            name: "Bianca",
            location: "Caracas",
            text: t('t2.text'),
        },
        {
            name: "Manuel",
            location: "Miami",
            text: t('t3.text'),
        },
    ];

    return (
        <section className="w-full py-8 bg-ac-beige text-ac-taupe" id="testimonials">
            <div className="max-w-6xl mx-auto px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    className="text-center mb-8"
                >
                    <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-ac-taupe mb-4">
                        {t('title')}
                    </h2>
                </motion.div>

                <TestimonialCarousel items={testimonials} />
            </div>
        </section>
    );
}
