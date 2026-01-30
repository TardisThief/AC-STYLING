"use client";

import { motion } from "framer-motion";
import { Calendar, MessageCircleQuestion, Archive, Tag } from "lucide-react";

const actions = [
    { label: "Book a Service", icon: Calendar, href: "#book" },
    { label: "Ask a Question", icon: MessageCircleQuestion, href: "#ask" },
    { label: "My Essentials", icon: Archive, href: "#essentials" },
    { label: "Brand Index", icon: Tag, href: "#brands" },
];

export default function ActionRow() {
    return (
        <section className="mb-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {actions.map((action, index) => (
                    <motion.a
                        key={action.label}
                        href={action.href}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index + 0.3, duration: 0.5, ease: "easeOut" }}
                        className="group relative flex flex-col items-center justify-center p-8 rounded-sm
                                 bg-white/40 backdrop-blur-md border border-white/20 shadow-sm
                                 hover:bg-white/60 hover:shadow-md transition-all duration-300
                                 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <action.icon
                            size={32}
                            className="text-ac-gold mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                        />

                        <span className="relative z-10 font-serif text-lg text-ac-taupe text-center leading-tight group-hover:text-ac-taupe/80 transition-colors">
                            {action.label}
                        </span>
                    </motion.a>
                ))}
            </div>
        </section>
    );
}
