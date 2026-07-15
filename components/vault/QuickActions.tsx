
"use client";

import { useState } from "react";
import { Calendar, MessageCircleQuestion, Archive, Tag, GraduationCap, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import AskAlejandraModal from "@/components/vault/AskAlejandraModal";
import { Link } from "@/i18n/routing";

interface QuickActionsProps {
    isMasterclassComplete?: boolean;
    isGuest?: boolean;
}

// Shared card chrome so every action reads as the same affordance.
const cardBase =
    "group relative flex flex-col lg:flex-row items-center lg:justify-start justify-center " +
    "p-4 rounded-sm border shadow-sm transition-colors duration-200 " +
    "overflow-hidden flex-1 min-h-[60px] lg:w-full text-center lg:text-left " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ac-sand";
const cardIdle = "bg-white/50 border-white/40 hover:bg-white/80";

export default function QuickActions({ isGuest = false }: QuickActionsProps) {
    const t = useTranslations('Vault');
    const [isAskModalOpen, setIsAskModalOpen] = useState(false);

    const links = [
        { label: t('actions.courses.label'), subtitle: t('actions.courses.subtitle'), icon: Archive, href: "/vault/courses" },
        { label: t('actions.studio.label'), subtitle: t('actions.studio.subtitle'), icon: Calendar, href: "/vault/services" },
        { label: t('actions.boutique.label'), subtitle: t('actions.boutique.subtitle'), icon: Tag, href: "/vault/boutique" },
    ];

    const iconClass = "text-ac-gold mb-2 lg:mb-0 lg:mr-4 shrink-0 transition-transform duration-200 group-hover:scale-110";
    const titleClass = "block font-serif text-lg leading-tight text-ac-taupe";
    const subtitleClass = "block text-[11px] uppercase tracking-widest text-ac-taupe/70 font-bold mt-0.5";

    return (
        <section className="h-full">
            <h3 className="font-serif text-lg text-ac-taupe mb-4 md:hidden">{t('quick_actions')}</h3>

            <div className="grid grid-cols-2 lg:flex lg:flex-col gap-3 h-full">

                {/* Primary action */}
                <Link
                    href="/vault/foundations"
                    className={`${cardBase} col-span-2 bg-ac-espresso border-ac-espresso shadow-md hover:bg-ac-taupe focus-visible:ring-offset-ac-sand`}
                >
                    <GraduationCap size={30} className={iconClass} aria-hidden="true" />
                    <div>
                        <span className="block font-serif text-lg leading-tight text-white">{t('masterclasses.title')}</span>
                        <span className="block text-[11px] uppercase tracking-widest text-ac-sand/90 font-bold mt-0.5">
                            {t('masterclasses.subtitle')}
                        </span>
                    </div>
                </Link>

                {links.map((action) => (
                    <Link key={action.label} href={action.href} className={`${cardBase} ${cardIdle}`}>
                        <action.icon size={30} className={iconClass} aria-hidden="true" />
                        <div>
                            <span className={titleClass}>{action.label}</span>
                            <span className={subtitleClass}>{action.subtitle}</span>
                        </div>
                    </Link>
                ))}

                {/* Ask Alejandra — a real button for members; a real upgrade path for guests
                    (previously an <a href="#"> that silently did nothing for guests). */}
                {isGuest ? (
                    <Link href="/vault/join" className={`${cardBase} ${cardIdle}`}>
                        <Lock size={30} className={iconClass} aria-hidden="true" />
                        <div>
                            <span className={titleClass}>{t('actions.ask.label')}</span>
                            <span className={subtitleClass}>{t('actions.ask.locked')}</span>
                        </div>
                    </Link>
                ) : (
                    <button type="button" onClick={() => setIsAskModalOpen(true)} className={`${cardBase} ${cardIdle}`}>
                        <MessageCircleQuestion size={30} className={iconClass} aria-hidden="true" />
                        <div>
                            <span className={titleClass}>{t('actions.ask.label')}</span>
                            <span className={subtitleClass}>{t('actions.ask.subtitle')}</span>
                        </div>
                    </button>
                )}
            </div>

            <AskAlejandraModal isOpen={isAskModalOpen} onClose={() => setIsAskModalOpen(false)} />
        </section>
    );
}
