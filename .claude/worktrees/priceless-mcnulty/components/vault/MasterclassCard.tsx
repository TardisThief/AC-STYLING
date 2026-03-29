"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Layers, Check } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";

interface MasterclassCardProps {
    masterclass: any;
    locale: string;
    isGuest: boolean;
    isCompleted: boolean;
    index: number;
    t: any; // Translations object or function
    href: string;
}

export default function MasterclassCard({
    masterclass,
    locale,
    isGuest,
    isCompleted,
    index,
    t,
    href
}: MasterclassCardProps) {
    // No video playback on card anymore, purely a link to detail page where video lives.

    const displayTitle = locale === 'es' && masterclass.title_es ? masterclass.title_es : masterclass.title;
    const displaySubtitle = locale === 'es' && masterclass.subtitle_es ? masterclass.subtitle_es : masterclass.subtitle;
    const displayThumb = masterclass.thumbnail_url;
    // const videoUrl = masterclass.video_url; // Used in detail page, not here for preview.

    return (
        <div className="group block relative">
            <div className="relative aspect-[16/9] overflow-hidden rounded-sm mb-3 shadow-md group-hover:shadow-xl transition-all duration-500 bg-black">
                <Link href={href} className="block w-full h-full relative">
                    <div className="absolute inset-0 bg-ac-taupe/20 group-hover:bg-ac-taupe/0 transition-colors z-10" />
                    <SafeImage
                        src={displayThumb}
                        alt={displayTitle}
                        className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${isGuest ? 'blur-[2px] grayscale' : 'grayscale group-hover:grayscale-0'}`}
                    />

                    {/* Guest Overlay */}
                    {isGuest && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/20 backdrop-blur-[1px]">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-2">
                                <Layers size={18} className="text-white" />
                            </div>
                            <span className="text-white text-[10px] uppercase font-bold tracking-widest">Founding Members Only</span>
                        </div>
                    )}

                    {/* View Button (Only if NOT guest, always show on hover) */}
                    {!isGuest && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                            <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/40 text-white font-serif tracking-widest">
                                VIEW COLLECTION
                            </div>
                        </div>
                    )}

                    {/* Badge - Label */}
                    <div className="absolute top-4 left-4 z-30 pointer-events-none">
                        <span className="bg-ac-gold text-white text-[10px] uppercase font-bold px-3 py-1 tracking-widest rounded-sm">
                            COLLECTION {index + 1}
                        </span>
                    </div>

                    {/* Completion Badge */}
                    <div className="absolute top-4 right-4 z-30 pointer-events-none">
                        {isCompleted && !isGuest && (
                            <div className="w-8 h-8 rounded-full bg-ac-olive flex items-center justify-center shadow-md ring-1 ring-white/20">
                                <Check size={16} className="text-ac-gold" />
                            </div>
                        )}
                    </div>
                </Link>
            </div>

            <Link href={href} className="block group">
                <h3 className="font-serif text-2xl text-ac-taupe group-hover:text-ac-olive transition-colors mb-1 flex items-center gap-2">
                    {displayTitle}
                    {isGuest && <span className="text-[10px] bg-ac-taupe/10 px-2 py-0.5 rounded-sm text-ac-taupe/60 uppercase font-bold tracking-normal">Locked</span>}
                </h3>
                <p className="text-ac-taupe/60 text-xs max-w-md line-clamp-2">
                    {displaySubtitle}
                </p>
            </Link>
        </div>
    );
}
