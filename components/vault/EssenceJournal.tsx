"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookHeart, Sparkles, ChevronDown, ChevronRight } from "lucide-react";

interface EssenceJournalProps {
    data: {
        title: string;
        entries: Array<{
            question_key: string;
            answer_value: any;
            chapter_slug: string;
            updated_at: string;
        }>;
    }[] | null;
}

export default function EssenceJournal({ data }: EssenceJournalProps) {
    // Track open state of each section by index
    const [openSections, setOpenSections] = useState<number[]>([0]); // Default first one open

    const toggleSection = (index: number) => {
        setOpenSections(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white/40 backdrop-blur-md rounded-sm border border-ac-taupe/10 min-h-[400px]">
                <Sparkles size={48} className="text-ac-gold mb-4 opacity-50" />
                <h3 className="font-serif text-2xl text-ac-taupe mb-2">Your Journal is Empty</h3>
                <p className="text-ac-taupe/60 max-w-md">
                    As you progress through the Masterclasses, your answers and style discoveries will be collected here automatically.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {data.map((collection, idx) => {
                const isOpen = openSections.includes(idx);

                return (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white/40 backdrop-blur-sm border border-ac-taupe/10 rounded-sm overflow-hidden"
                    >
                        {/* Header / Toggler */}
                        <button
                            onClick={() => toggleSection(idx)}
                            className="w-full flex items-center justify-between p-6 bg-white/40 hover:bg-white/60 transition-colors text-left"
                        >
                            <div className="flex items-center gap-4">
                                <BookHeart size={20} className="text-ac-gold" />
                                <h2 className="font-serif text-2xl text-ac-taupe">{collection.title}</h2>
                                <span className="text-xs font-bold text-ac-taupe/40 uppercase tracking-widest border border-ac-taupe/10 px-2 py-1 rounded-full">
                                    {collection.entries.length} Entries
                                </span>
                            </div>
                            {isOpen ? <ChevronDown size={20} className="text-ac-taupe/60" /> : <ChevronRight size={20} className="text-ac-taupe/60" />}
                        </button>

                        {/* Collapsible Content */}
                        <AnimatePresence>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="p-6 pt-0 grid gap-3 border-t border-ac-taupe/5">
                                        <div className="h-4" /> {/* Spacer */}
                                        {collection.entries.map((entry, eIdx) => (
                                            <div
                                                key={eIdx}
                                                className="bg-white/60 p-4 rounded-sm border border-ac-taupe/5 shadow-sm hover:shadow-md transition-shadow relative group"
                                            >
                                                <div className="absolute top-0 left-0 w-0.5 h-full bg-ac-gold/50 group-hover:bg-ac-gold transition-colors" />

                                                <div className="flex flex-col md:flex-row md:items-baseline gap-2 mb-2">
                                                    <h3 className="font-serif text-base text-ac-taupe/80 italic flex-grow">
                                                        "{entry.question_key.replace(/_/g, ' ')}"
                                                    </h3>
                                                    <span className="text-[10px] uppercase tracking-widest text-ac-taupe/30 font-bold whitespace-nowrap">
                                                        {entry.chapter_slug || 'General'}
                                                    </span>
                                                </div>

                                                <div className="font-serif text-lg text-ac-taupe leading-snug">
                                                    {typeof entry.answer_value === 'string' ? (
                                                        entry.answer_value
                                                    ) : (
                                                        <pre className="text-xs font-sans whitespace-pre-wrap text-ac-taupe/70 bg-ac-taupe/5 p-2 rounded-sm">
                                                            {JSON.stringify(entry.answer_value, null, 2)}
                                                        </pre>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}

            <div className="text-center pt-8 text-ac-taupe/40 italic text-sm">
                — End of Journal —
            </div>
        </div>
    );
}
