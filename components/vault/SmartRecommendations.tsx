"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function SmartRecommendations({ hasStartedCourse = false }: { hasStartedCourse?: boolean }) {

    // Logic for the dynamic card
    const mainActionCard = hasStartedCourse
        ? {
            title: "Book 1:1 Consultation",
            subtitle: "Refine Your Style",
            image: "https://images.unsplash.com/photo-1596704017254-9b121068fb6b?q=80&w=2070&auto=format&fit=crop", // Meeting/Stylist
            cta: "Schedule Now"
        }
        : {
            title: "Start Identity Lab",
            subtitle: "Discover Your Core",
            image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=2070&auto=format&fit=crop", // Fashion/Model
            cta: "Begin Module 1"
        };

    const recommendations = [
        mainActionCard,
        {
            title: "Weekly Wardrobe Planner",
            subtitle: "Downloadable Tool",
            image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=2072&auto=format&fit=crop", // Planner/Desk
            cta: "Download PDF"
        },
        {
            title: "Trend Report: Quiet Luxury",
            subtitle: "Exclusive Insight",
            image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=2070&auto=format&fit=crop", // Fashion/Catwalk
            cta: "Read Article"
        }
    ];

    return (
        <section>
            <div className="flex items-center gap-2 mb-6">
                <Sparkles className="text-ac-gold" size={20} />
                <h3 className="font-serif text-2xl text-ac-taupe">Handpicked for You</h3>
            </div>

            {/* Horizontal Scroll Container */}
            <div className="flex overflow-x-auto space-x-6 pb-8 snap-x snap-mandatory scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
                {recommendations.map((card, index) => {
                    const CardContent = (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + (index * 0.1), duration: 0.6, ease: "easeOut" }}
                            className="snap-center shrink-0 w-[85vw] md:w-[400px] h-[500px] relative rounded-sm overflow-hidden group cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-300"
                        >
                            <img
                                src={card.image}
                                alt={card.title}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-ac-taupe/90 via-transparent to-transparent" />

                            <div className="absolute bottom-0 left-0 p-8 w-full">
                                <span className="text-ac-sand/80 text-xs font-bold tracking-widest uppercase mb-2 block">
                                    {card.subtitle}
                                </span>
                                <h4 className="font-serif text-3xl text-white mb-6">
                                    {card.title}
                                </h4>

                                <div className="flex items-center justify-between border-t border-white/20 pt-4">
                                    <span className="text-white text-sm tracking-widest uppercase font-semibold group-hover:text-ac-gold transition-colors">
                                        {card.cta}
                                    </span>
                                    <div className="bg-white/10 p-2 rounded-full group-hover:bg-ac-gold group-hover:text-white transition-all duration-300">
                                        <ArrowRight size={18} className="text-white" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );

                    if (card.title === "Start Identity Lab") {
                        return (
                            <Link href="/vault/foundations" key={card.title}>
                                {CardContent}
                            </Link>
                        )
                    }

                    return CardContent;
                })}
            </div>
            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </section>
    );
}
