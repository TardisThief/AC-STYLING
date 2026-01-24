"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function WhatsNew() {
    return (
        <section className="h-full flex flex-col gap-6">

            {/* 1. Editorial Banner (High Priority) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative w-full h-full overflow-hidden rounded-sm shadow-md group cursor-pointer"
            >
                {/* Desktop Image */}
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-ac-taupe/80 to-transparent z-10" />
                    <img
                        src="/images/vault-hero-desktop.jpg"
                        alt="Editorial"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070&auto=format&fit=crop';
                        }}
                    />
                </div>

                <div className="absolute bottom-0 left-0 p-6 md:p-8 z-20 text-white max-w-lg">
                    <span className="inline-block px-3 py-1 mb-3 text-xs font-bold tracking-widest uppercase bg-ac-gold/90 text-white backdrop-blur-sm">
                        Editorial
                    </span>
                    <h2 className="font-serif text-2xl md:text-4xl leading-tight mb-3">
                        The Spring '26 Capsule: Refined utility.
                    </h2>
                    <span className="inline-flex items-center text-sm font-bold tracking-widest uppercase border-b border-white hover:text-ac-beige transition-colors">
                        Read Story
                    </span>
                </div>
            </motion.div>

            {/* 2. New Course / Upload (Secondary) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="bg-white/60 backdrop-blur-sm border border-white/40 p-6 rounded-sm flex flex-col md:flex-row gap-6 items-center shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            >
                <div className="relative w-full md:w-32 h-32 flex-shrink-0 overflow-hidden rounded-sm">
                    <img
                        src="https://images.unsplash.com/photo-1529139574466-a302d2052574?q=80&w=2070&auto=format&fit=crop"
                        alt="Course Thumbnail"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="bg-white/20 p-2 rounded-full backdrop-blur-md group-hover:scale-110 transition-transform">
                            <Play size={20} className="text-white fill-white" />
                        </div>
                    </div>
                </div>

                <div className="flex-grow text-center md:text-left">
                    <span className="text-ac-olive font-bold text-xs uppercase tracking-wider mb-1 block">
                        New Masterclass
                    </span>
                    <h3 className="font-serif text-2xl text-ac-taupe mb-2">
                        Color Theory: Finding Your Palette
                    </h3>
                    <p className="text-ac-taupe/70 text-sm line-clamp-2">
                        Understand the psychology of color and how to build a wardrobe that enhances your natural tone.
                    </p>
                </div>
            </motion.div>

        </section>
    );
}
