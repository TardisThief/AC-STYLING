"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Globe, Lock } from "lucide-react";
import Player from '@vimeo/player';

interface VaultVideoPlayerProps {
    videoId: string; // Vimeo ID (Default/EN)
    videoIdEs?: string; // Vimeo ID (Spanish)
    title?: string;
    locale?: string;
}

export default function VaultVideoPlayer({ videoId, videoIdEs, title, locale: initialLocale }: VaultVideoPlayerProps) {
    const hookLocale = useLocale();
    const currentLocale = initialLocale || hookLocale;

    // State

    const [isPrivacyError, setIsPrivacyError] = useState(false);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<Player | null>(null);

    // Automatically select video based on locale. Fallback to EN if ES is not available.
    const currentVideoId = (currentLocale === 'es' && videoIdEs) ? videoIdEs : videoId;

    useEffect(() => {
        if (!containerRef.current || !currentVideoId) return;

        // Reset error state and cleanup old player

        if (playerRef.current) {
            playerRef.current.destroy().catch(() => { });
            playerRef.current = null;
        }

        // Initialize Player
        const player = new Player(containerRef.current, {
            id: Number(currentVideoId),
            title: false,
            byline: false,
            portrait: false,
            color: 'd4af37',
            dnt: true,
            responsive: true,
        });

        playerRef.current = player;

        player.on('error', (data) => {
            console.warn("Vimeo Player Error:", data);
            if (data.name === 'PrivacyError' || (data as { message?: string }).message?.toLowerCase().includes('privacy')) {
                setIsPrivacyError(true);
            }
        });

        return () => {
            player.destroy().catch(() => { });
        };
    }, [currentVideoId]);


    return (
        <div className="space-y-3">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative w-full rounded-sm overflow-hidden border border-white/20 shadow-lg`}
            >
                <div className="w-full aspect-video bg-ac-taupe/10 relative">
                    {isPrivacyError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-8 text-center">
                            <div className="w-12 h-12 bg-ac-gold/20 rounded-full flex items-center justify-center mb-4">
                                <Lock size={20} className="text-ac-gold" />
                            </div>
                            <h3 className="font-serif text-xl text-white mb-2">Private Content</h3>
                            <p className="text-white/60 text-xs max-w-sm">
                                This video is domain-protected. If you are seeing this on a development environment, this is expected behavior.
                            </p>
                        </div>
                    ) : (
                        <div ref={containerRef} className="w-full h-full" />
                    )}
                </div>
            </motion.div>


        </div>
    );
}
