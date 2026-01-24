
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";
import { Calendar, MessageCircleQuestion, Archive, Tag } from "lucide-react";
import AskAlejandraModal from "@/components/vault/AskAlejandraModal";

const actions = [
    { label: "Courses", icon: Archive, href: "#courses", action: null },
    { label: "Book a Service", icon: Calendar, href: "#book", action: null },
    { label: "Brand Index", icon: Tag, href: "#brands", action: null },
    { label: "Ask Ale a Question", icon: MessageCircleQuestion, href: "#", action: "ask" },
];

export default function QuickActions() {
    const [isAskModalOpen, setIsAskModalOpen] = useState(false);

    const handleActionClick = (actionType: string | null, e: React.MouseEvent) => {
        if (actionType === 'ask') {
            e.preventDefault();
            setIsAskModalOpen(true);
        }
    };

    return (
        <section className="h-full">
            <h3 className="font-serif text-lg text-ac-taupe mb-4 md:hidden">Quick Actions</h3>
            {/* 
                Grid Layout:
                Mobile: grid-cols-2 (2x2)
                Desktop (lg): flex-col (Vertical Sidebar)
            */}
            <div className="grid grid-cols-2 lg:flex lg:flex-col gap-4 h-full">

                {/* 1. Permanent Collection (Primary Action) */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
                    className="col-span-2 lg:col-span-1"
                >
                    <Link
                        href="/vault/foundations"
                        className="group relative flex flex-col lg:flex-row items-center lg:items-center justify-center lg:justify-start 
                                    p-6 lg:p-4 rounded-sm
                                    bg-ac-taupe text-white shadow-md
                                    hover:bg-ac-taupe/90 hover:shadow-lg transition-all duration-300
                                    overflow-hidden lg:h-24 lg:w-full block h-full w-full"
                    >
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Archive
                            size={24}
                            className="text-ac-gold mb-3 lg:mb-0 lg:mr-4 transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="text-center lg:text-left">
                            <span className="block font-serif text-lg lg:text-xl leading-tight group-hover:text-ac-beige transition-colors">
                                Masterclass
                            </span>
                            <span className="text-[10px] uppercase tracking-widest text-ac-sand/60">
                                Foundations Module
                            </span>
                        </div>
                    </Link>
                </motion.div>

                {actions.map((action, index) => (
                    <motion.a
                        key={action.label}
                        href={action.href}
                        onClick={(e) => handleActionClick(action.action, e)}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index + 0.3, duration: 0.5, ease: "easeOut" }}
                        className="group relative flex flex-col lg:flex-row items-center lg:items-center justify-center lg:justify-start 
                                 p-6 lg:p-4 rounded-sm
                                 bg-white/40 backdrop-blur-md border border-white/20 shadow-sm
                                 hover:bg-white/60 hover:shadow-md transition-all duration-300
                                 overflow-hidden lg:h-24 lg:w-full cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <action.icon
                            size={24}
                            className="text-ac-gold mb-3 lg:mb-0 lg:mr-4 transition-transform duration-300 group-hover:scale-110"
                        />

                        <span className="relative z-10 font-serif text-sm lg:text-base text-ac-taupe text-center lg:text-left leading-tight group-hover:text-ac-taupe/80 transition-colors">
                            {action.label}
                        </span>
                    </motion.a>
                ))}
            </div>

            <AskAlejandraModal isOpen={isAskModalOpen} onClose={() => setIsAskModalOpen(false)} />
        </section>
    );
}

