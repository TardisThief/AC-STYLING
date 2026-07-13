
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { BoutiqueItem } from "@/app/actions/boutique";
import { ExternalLink, Sparkles, Bookmark } from "lucide-react";
import { toggleBoutiqueSave } from "@/app/actions/boutique-saves";
import { useTransition } from "react";

interface ProductGridProps {
    items: BoutiqueItem[];
    locale: string;
    savedIds: Set<string>;
    onSaveToggle: (itemId: string, isSaved: boolean) => void;
}

export default function ProductGrid({ items, locale, savedIds, onSaveToggle }: ProductGridProps) {
    const [isPending, startTransition] = useTransition();

    const trackUrl = (item: BoutiqueItem) =>
        `/api/boutique/track?item_id=${item.id}&locale=${locale}`;

    const handleBookmark = (item: BoutiqueItem) => {
        const willBeSaved = !savedIds.has(item.id);
        // Optimistic update immediately
        onSaveToggle(item.id, willBeSaved);
        startTransition(async () => {
            const res = await toggleBoutiqueSave(item.id);
            // Revert if server disagrees
            if (res.saved !== willBeSaved) {
                onSaveToggle(item.id, res.saved);
            }
        });
    };

    if (items.length === 0) {
        return (
            <div className="py-20 text-center text-ac-taupe/40">
                <p className="font-serif text-xl italic">No curated items found.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            <AnimatePresence mode="popLayout">
                {items.map((item) => {
                    const isSaved = savedIds.has(item.id);
                    return (
                        <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className="group"
                        >
                            {/* Image Card */}
                            <div className="relative aspect-[3/4] overflow-hidden rounded-sm mb-4 bg-[#F2EFE9]">
                                <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                />

                                {/* Curator Tip Overlay */}
                                {item.curator_note && (
                                    <div className="absolute inset-0 bg-ac-taupe/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-8 text-center">
                                        <Sparkles className="text-ac-gold mb-3" size={24} />
                                        <p className="text-ac-beige font-serif text-lg italic leading-relaxed">
                                            &quot;{item.curator_note}&quot;
                                        </p>
                                        <div className="mt-4 w-8 h-[1px] bg-ac-gold/50" />
                                        <p className="text-xs uppercase tracking-widest text-ac-gold/80 mt-2">Alejandra&apos;s Note</p>
                                    </div>
                                )}

                                {/* Bookmark Button (Top Right) */}
                                <button
                                    onClick={() => handleBookmark(item)}
                                    className={`absolute top-3 right-3 z-20 p-2 rounded-full backdrop-blur-sm transition-all ${
                                        isSaved
                                            ? 'bg-ac-gold text-white shadow-md'
                                            : 'bg-white/80 text-ac-taupe/60 opacity-0 group-hover:opacity-100 hover:text-ac-gold'
                                    }`}
                                    title={isSaved ? 'Remove from saved' : 'Save item'}
                                >
                                    <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
                                </button>

                                {/* Shop Now Button */}
                                <a
                                    href={trackUrl(item)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute bottom-0 right-0 bg-white text-ac-taupe px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-ac-taupe hover:text-white transition-colors z-20 flex items-center gap-2"
                                >
                                    Shop Now <ExternalLink size={12} />
                                </a>
                            </div>

                            {/* Details */}
                            <div className="text-center">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">
                                    {item.brand?.name || 'Partner Brand'}
                                </h4>
                                <h3 className="font-serif text-xl text-ac-taupe leading-tight group-hover:text-ac-olive transition-colors cursor-pointer">
                                    <a href={trackUrl(item)} target="_blank" rel="noopener noreferrer">
                                        {item.name}
                                    </a>
                                </h3>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
