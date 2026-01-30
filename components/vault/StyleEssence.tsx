'use client';

import { motion } from 'framer-motion';
import { StyleEssentials } from '@/app/actions/vault/profile';
import Link from 'next/link';

export default function StyleEssence({ essence }: { essence: StyleEssentials }) {
    // Fallback if empty
    const isEmpty = !essence.styleWords.length && !essence.archetype.length;

    // Formatting: Join multiple words with ' • '
    const words = essence.styleWords.length > 0 ? essence.styleWords.join(' • ') : "Your Style Essence";
    const archetype = essence.archetype.length > 0 ? essence.archetype.join(' + ') : "Undiscovered Archetype";

    return (
        <section className="mb-12 md:mb-16">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-center"
            >
                <div className="inline-block mb-4">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-ac-gold font-bold">
                        {archetype}
                    </span>
                </div>

                <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-ac-taupe leading-none tracking-tight mb-8">
                    {words}
                </h1>

                {/* Additional Features Row */}
                {(essence.powerFeatures.length > 0 || essence.colorEnergy.length > 0) && (
                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-8 text-ac-taupe/60 text-xs uppercase tracking-widest font-bold max-w-2xl mx-auto">
                        {essence.powerFeatures.map(f => (
                            <span key={f.value} className="flex gap-1">
                                <span className="opacity-60">{f.label}:</span>
                                <span className="text-ac-taupe">{f.value}</span>
                            </span>
                        ))}
                        {essence.colorEnergy.map(c => (
                            <span key={c.value} className="flex gap-1">
                                <span className="opacity-60">{c.label}:</span>
                                <span className="text-ac-taupe">{c.value}</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* Journal Link (User Request) */}
                <Link
                    href="/vault/essence"
                    className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-ac-taupe/40 hover:text-ac-gold transition-colors border-b border-transparent hover:border-ac-gold pb-1"
                >
                    View Full Essence Journal
                </Link>
            </motion.div>
        </section>
    );
}
