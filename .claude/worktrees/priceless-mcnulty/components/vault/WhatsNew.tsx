
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import VaultHero from "./VaultHero";
import { PulseContent } from "@/app/actions/dashboard";
import SafeImage from "@/components/ui/SafeImage";

interface WhatsNewProps {
    pulse?: PulseContent[] | null;
}

export default function WhatsNew({ pulse = [] }: WhatsNewProps) {
    const t = useTranslations('Vault');
    const items = pulse && pulse.length > 0 ? pulse : [];
    const [currentIndex, setCurrentIndex] = useState(0);

    // Auto-rotate
    useEffect(() => {
        if (items.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % items.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [items.length]);

    const activeItem = items[currentIndex];

    // Fallback if no items at all (should be covered by server action but safe to have)
    const fallbackItem = {
        id: 'default',
        type: 'news',
        label: 'The Lab',
        title: 'Welcome to your Vault',
        subtitle: 'Your personal style journey starts here.',
        link_url: '/vault/courses',
        image_url: 'https://images.unsplash.com/photo-1490481651871-ab52661227ed?q=80&w=2070&auto=format&fit=crop'
    };

    const displayItem = activeItem || fallbackItem;

    return (
        <section className="flex flex-col gap-4">

            {/* 1. Static Editorial Banner - Compressed Height (~350px max) */}
            <div className="relative w-full overflow-hidden rounded-sm shadow-md group cursor-pointer h-[320px] md:h-[380px]">
                <div className="absolute inset-0 top-[-10%]">
                    <VaultHero />
                </div>
            </div>

            {/* 2. Pulse Card (Single Rotating Card) - Partially Visible at Bottom */}
            <div className="relative">
                <div className="flex justify-between items-end mb-1 px-1">
                    <h3 className="font-serif text-base text-ac-taupe/60 italic">{t('pulse')}</h3>

                    {/* Dots */}
                    {items.length > 1 && (
                        <div className="flex gap-1.5">
                            {items.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-4 bg-ac-gold' : 'w-1.5 bg-ac-taupe/20 hover:bg-ac-taupe/40'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <Link href={displayItem.link_url} className="block group">
                    <div className="bg-white/60 backdrop-blur-sm border border-white/40 p-4 rounded-sm flex flex-col md:flex-row gap-4 items-center shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-h-[140px]">

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={displayItem.id ? displayItem.id : 'default'}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.5 }}
                                className="flex flex-col md:flex-row gap-4 items-center w-full"
                            >
                                {/* Image */}
                                <div className="relative w-full md:w-24 h-24 flex-shrink-0 overflow-hidden rounded-sm bg-ac-taupe/5">
                                    <SafeImage
                                        src={displayItem.image_url}
                                        alt={displayItem.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    {(displayItem.type === 'continue' || displayItem.type === 'new_learning') && (
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                                                <Play size={12} className="text-white fill-white" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Text */}
                                <div className="flex-grow text-center md:text-left">
                                    <span className="text-ac-olive font-bold text-[10px] uppercase tracking-wider mb-0.5 block">
                                        {displayItem.label}
                                    </span>
                                    <h3 className="font-serif text-xl text-ac-taupe mb-1 leading-tight">
                                        {displayItem.title}
                                    </h3>
                                    <p className="text-ac-taupe/70 text-xs line-clamp-2">
                                        {displayItem.subtitle}
                                    </p>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </Link>
            </div>

        </section>
    );
}
