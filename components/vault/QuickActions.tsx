
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";
import { Calendar, MessageCircleQuestion, Archive, Tag, BookHeart } from "lucide-react";
import { useTranslations } from "next-intl";
import AskAlejandraModal from "@/components/vault/AskAlejandraModal";

interface QuickActionsProps {
    isMasterclassComplete?: boolean;
}

export default function QuickActions({ isMasterclassComplete = false }: QuickActionsProps) {
    const t = useTranslations('Vault');
    const [isAskModalOpen, setIsAskModalOpen] = useState(false);

    const actions = [
        { label: t('actions.courses.label'), subtitle: t('actions.courses.subtitle'), icon: Archive, href: "/vault/courses", action: null },
        { label: t('actions.studio.label'), subtitle: t('actions.studio.subtitle'), icon: Calendar, href: "/vault/services", action: null },
        { label: t('actions.boutique.label'), subtitle: t('actions.boutique.subtitle'), icon: Tag, href: "/vault/boutique", action: null },
        { label: t('actions.ask.label'), subtitle: t('actions.ask.subtitle'), icon: MessageCircleQuestion, href: "#", action: "ask" },
    ];

    const handleActionClick = (actionType: string | null, e: React.MouseEvent) => {
        if (actionType === 'ask') {
            e.preventDefault();
            setIsAskModalOpen(true);
        }
    };

    return (
        <section className="h-full">
            <h3 className="font-serif text-lg text-ac-taupe mb-4 md:hidden">{t('quick_actions')}</h3>
            {/* 
                Grid Layout:
                Mobile: grid-cols-2 (2x2)
                Desktop (lg): flex-col (Vertical Sidebar)
            */}
            <div className="grid grid-cols-2 lg:flex lg:flex-col gap-3 h-full">

                {/* 1. Permanent Collection (Primary Action) - COMPRESSED */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
                    className="col-span-2 lg:col-span-1"
                >
                    <Link
                        href="/vault/foundations"
                        className={`group relative flex flex-col lg:flex-row items-center lg:items-center justify-center lg:justify-start 
                                    p-4 lg:p-3 rounded-sm
                                    border border-ac-sand shadow-sm
                                    bg-white/40 backdrop-blur-md
                                    hover:bg-ac-taupe/5 hover:shadow-md transition-all duration-300
                                    overflow-hidden lg:h-20 lg:w-full block h-full w-full`}
                    >
                        <Archive
                            size={20}
                            className="text-ac-taupe mb-2 lg:mb-0 lg:mr-3 transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="text-center lg:text-left">
                            <span className="block font-serif text-base lg:text-lg leading-tight text-ac-taupe group-hover:text-ac-taupe/80 transition-colors">
                                {t('masterclasses.title')}
                            </span>
                            <span className="text-[9px] uppercase tracking-widest text-ac-taupe/60 font-bold">
                                {t('masterclasses.subtitle')}
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
                                 p-4 lg:p-3 rounded-sm
                                 bg-white/40 backdrop-blur-md border border-white/20 shadow-sm
                                 hover:bg-white/60 hover:shadow-md transition-all duration-300
                                 overflow-hidden lg:h-20 lg:w-full cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <action.icon
                            size={20}
                            className="text-ac-gold mb-2 lg:mb-0 lg:mr-3 transition-transform duration-300 group-hover:scale-110"
                        />

                        <div className="relative z-10 text-center lg:text-left">
                            <span className="block font-serif text-xs lg:text-sm text-ac-taupe leading-tight group-hover:text-ac-taupe/80 transition-colors">
                                {action.label}
                            </span>
                            <span className="block text-[9px] uppercase tracking-widest text-ac-taupe/40 font-bold mt-0.5">
                                {action.subtitle}
                            </span>
                        </div>
                    </motion.a>
                ))}
            </div>

            <AskAlejandraModal isOpen={isAskModalOpen} onClose={() => setIsAskModalOpen(false)} />
        </section>
    );
}

