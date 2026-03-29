
"use client";

import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";
import { ChevronRight } from "lucide-react";

export default function VaultHero() {
    return (
        <section className="h-full w-full">
            <div className="relative w-full aspect-[3/4] md:aspect-[21/9] overflow-hidden rounded-sm shadow-lg group h-full">

                {/* Mobile Image */}
                <div className="absolute inset-0 block md:hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-ac-taupe/90 via-transparent to-transparent z-10" />
                    <img
                        src="https://images.unsplash.com/photo-1490481651871-ab52661227ed?q=80&w=2070&auto=format&fit=crop"
                        alt="Editorial"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1490481651871-ab52661227ed?q=80&w=2070&auto=format&fit=crop"; }}
                    />
                </div>

                {/* Desktop Image */}
                <div className="absolute inset-0 hidden md:block">
                    <div className="absolute inset-0 bg-gradient-to-r from-ac-taupe/80 via-ac-taupe/10 to-transparent z-10" />
                    <img
                        src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070&auto=format&fit=crop"
                        alt="Editorial"
                        className="w-full h-full object-cover transition-transform duration-[10s] ease-linear scale-100 group-hover:scale-105"
                        onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070&auto=format&fit=crop"; }}
                    />
                </div>

                {/* Content Overlay - Static Editorial */}
                {/* Positioned higher (bottom-12/16) + Liquid Glass Container */}
                <div className="absolute bottom-8 left-6 md:bottom-16 md:left-12 z-20 max-w-xl w-full">
                    <div className="bg-white/10 backdrop-blur-md p-8 rounded-sm border border-white/20 shadow-sm relative overflow-hidden">
                        {/* Shimmer effect / Glass highlight */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="relative z-10 text-white"
                        >
                            <span className="inline-block px-3 py-1 mb-3 text-xs font-bold tracking-widest uppercase bg-ac-gold text-white shadow-sm">
                                Editorial
                            </span>
                            <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-4 drop-shadow-md">
                                The Spring '26 Capsule: Refined utility.
                            </h2>
                            <Link
                                href="/vault/boutique"
                                className="inline-flex items-center gap-2 text-sm font-bold tracking-widest uppercase border-b-2 border-white/30 pb-1 hover:border-ac-gold hover:text-ac-gold transition-all"
                            >
                                Explore the Collection
                                <ChevronRight size={14} />
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
