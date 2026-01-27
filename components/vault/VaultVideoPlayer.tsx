"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";

interface VaultVideoPlayerProps {
    videoId: string; // Vimeo ID (Default/EN)
    videoIdEs?: string; // Vimeo ID (Spanish)
    title?: string;
}

export default function VaultVideoPlayer({ videoId, videoIdEs, title }: VaultVideoPlayerProps) {
    const locale = useLocale();
    const [isFocused, setIsFocused] = useState(false);
    const [activeLang, setActiveLang] = useState<'en' | 'es'>(locale === 'es' ? 'es' : 'en');

    // Force sync if locale changes (e.g. user toggles site language)
    useEffect(() => {
        setActiveLang(locale === 'es' && videoIdEs ? 'es' : 'en');
    }, [locale, videoIdEs]);

    const currentVideoId = activeLang === 'es' && videoIdEs ? videoIdEs : videoId;

    return (
        <div className="space-y-3">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative w-full rounded-sm overflow-hidden transition-all duration-500
                    ${isFocused
                        ? "ring-1 ring-ac-gold shadow-2xl scale-[1.01]"
                        : "ring-1 ring-white/20 shadow-lg"
                    }`}
                onMouseEnter={() => setIsFocused(true)}
                onMouseLeave={() => setIsFocused(false)}
            >
                {/* Liquid Glass Overlay Effect (Subtle) */}
                {!isFocused && (
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] z-10 pointer-events-none transition-opacity duration-500" />
                )}

                <div className="w-full aspect-video bg-ac-taupe/10 relative">
                    <iframe
                        src={`https://player.vimeo.com/video/${currentVideoId}?title=0&byline=0&portrait=0&color=d4af37`}
                        className="absolute top-0 left-0 w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        title={title || "Video Player"}
                    />
                </div>
            </motion.div>

            {/* Language Switcher Overlay / Bottom Bar */}
            {videoIdEs && (
                <div className="flex justify-end pt-2">
                    <div className="inline-flex items-center gap-1 bg-white/40 backdrop-blur-md border border-white/30 rounded-full px-4 py-1.5 shadow-sm">
                        <Globe size={12} className="text-ac-taupe/40" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-ac-taupe/40 mr-2">Language</span>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setActiveLang('en')}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full transition-all
                                    ${activeLang === 'en' ? 'bg-ac-taupe text-white shadow-sm' : 'text-ac-taupe hover:bg-white/40'}`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setActiveLang('es')}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full transition-all
                                    ${activeLang === 'es' ? 'bg-ac-taupe text-white shadow-sm' : 'text-ac-taupe hover:bg-white/40'}`}
                            >
                                ES
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
