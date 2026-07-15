
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import EditorialPanel from "./EditorialPanel";
import { PulseContent, EditorialContent } from "@/app/actions/dashboard";
import SafeImage from "@/components/ui/SafeImage";

interface WhatsNewProps {
    pulse?: PulseContent[] | null;
    editorial: EditorialContent;
}

export default function WhatsNew({ pulse = [], editorial }: WhatsNewProps) {
    const t = useTranslations('Vault');
    const reduce = useReducedMotion();
    const items = pulse && pulse.length > 0 ? pulse : [];
    const [currentIndex, setCurrentIndex] = useState(0);
    // Rotation stops for good once the member takes control (or prefers reduced
    // motion); it pauses while they're reading (hover/focus) so the click target
    // can never change out from under the cursor.
    const [userTookControl, setUserTookControl] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    const isRotating = items.length > 1 && !userTookControl && !reduce && !isPaused;

    useEffect(() => {
        if (!isRotating) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % items.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [isRotating, items.length]);

    const activeItem = items[currentIndex];

    const fallbackItem = {
        id: 'default',
        type: 'news',
        label: t('fallback.label'),
        title: t('fallback.title'),
        subtitle: t('fallback.subtitle'),
        link_url: '/vault/courses',
        image_url: 'https://images.unsplash.com/photo-1490481651871-ab52661227ed?q=80&w=2070&auto=format&fit=crop'
    };

    const displayItem = activeItem || fallbackItem;

    return (
        <section className="flex flex-col gap-4">

            {/* 1. Editorial Panel */}
            <EditorialPanel editorial={editorial} />

            {/* 2. The Pulse */}
            <div
                className="relative"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onFocusCapture={() => setIsPaused(true)}
                onBlurCapture={() => setIsPaused(false)}
            >
                <div className="flex justify-between items-end mb-1 px-1">
                    <h3 className="font-serif text-base text-ac-taupe/80 italic">{t('pulse')}</h3>

                    {items.length > 1 && (
                        <div className="flex items-center gap-1.5">
                            {items.map((item, idx) => (
                                <button
                                    key={item.id ?? idx}
                                    type="button"
                                    onClick={() => { setCurrentIndex(idx); setUserTookControl(true); }}
                                    aria-label={t('pulse_goto', { number: idx + 1 })}
                                    aria-current={idx === currentIndex ? "true" : undefined}
                                    className={`h-1.5 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ac-sand ${idx === currentIndex ? 'w-4 bg-ac-gold' : 'w-1.5 bg-ac-taupe/40 hover:bg-ac-taupe/60'
                                        }`}
                                />
                            ))}
                            {!userTookControl && !reduce && (
                                <button
                                    type="button"
                                    onClick={() => setUserTookControl(true)}
                                    aria-label={t('pulse_pause')}
                                    className="ml-1 text-ac-taupe/60 hover:text-ac-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ac-sand rounded-full transition-colors"
                                >
                                    <Pause size={12} />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <Link href={displayItem.link_url} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ac-sand rounded-sm">
                    <div className="bg-white/60 backdrop-blur-sm border border-white/40 p-4 rounded-sm flex flex-col md:flex-row gap-4 items-center shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-h-[140px]">

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={displayItem.id ? displayItem.id : 'default'}
                                initial={{ opacity: 0, x: reduce ? 0 : 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: reduce ? 0 : -12 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                                className="flex flex-col md:flex-row gap-4 items-center w-full"
                            >
                                <div className="relative w-full md:w-24 h-24 flex-shrink-0 overflow-hidden rounded-sm bg-ac-taupe/5">
                                    <SafeImage
                                        src={displayItem.image_url}
                                        alt=""
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    {(displayItem.type === 'continue' || displayItem.type === 'new_learning') && (
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                                                <Play size={12} className="text-white fill-white" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-grow text-center md:text-left">
                                    <span className="text-ac-olive-dark font-bold text-[11px] uppercase tracking-wider mb-0.5 block">
                                        {displayItem.label}
                                    </span>
                                    <h3 className="font-serif text-xl text-ac-taupe mb-1 leading-tight">
                                        {displayItem.title}
                                    </h3>
                                    <p className="text-ac-taupe/80 text-sm line-clamp-2">
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
