"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface VaultVideoPlayerProps {
    videoId: string; // Vimeo ID
    title?: string;
}

export default function VaultVideoPlayer({ videoId, title }: VaultVideoPlayerProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
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
                    src={`https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0&color=d4af37`}
                    className="absolute top-0 left-0 w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={title || "Video Player"}
                />
            </div>
        </motion.div>
    );
}
