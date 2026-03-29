"use client";

import { motion, Variants } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { createCheckoutSession } from "@/app/actions/stripe";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "@/i18n/routing";

interface Service {
    id: string;
    title: string;
    description: string;
    subtitle?: string;
    price_display: string;
    stripe_url: string;
    price_id?: string;
    image_url: string;
    type?: string;
}

interface ServicesGridProps {
    sessionServices: Service[];
    retainerService?: Service;
    recommendedServiceId: string | null;
    recommendationReason?: string;
    isGuest?: boolean;
}

const retainerVariants: Variants = {
    hidden: { opacity: 0, y: -50 }, // From top
    show: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] } }
};

const gridContainerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2, // Stagger cards
            delayChildren: 0.5   // Wait for retainer to start
        }
    }
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 100 }, // From bottom (Meeting in the middle)
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

export default function ServicesGrid({ sessionServices, retainerService, recommendedServiceId, recommendationReason, isGuest }: ServicesGridProps) {
    const t = useTranslations('Studio');
    const searchParams = useSearchParams();
    const [showSuccess, setShowSuccess] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (searchParams.get('checkout_success')) {
            setShowSuccess(true);
            // Clean URL without refresh
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, [searchParams]);

    const handleCheckout = async (priceId: string) => {
        if (isGuest) {
            if (typeof window !== 'undefined') {
                localStorage.setItem('redirect_to', '/vault/services');
            }
            router.push('/vault/join');
            return;
        }

        if (!priceId) {
            toast.error("Configuration Error: Missing Price ID");
            return;
        }

        // ... (rest of handleCheckout logic)
        const toastId = toast.loading("Securely redirecting to Stripe...");

        try {
            const { url, error } = await createCheckoutSession(priceId, '/vault/services');
            if (error) throw new Error(error);
            if (url) window.location.href = url;
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : "Checkout initialization failed";
            toast.error(errorMessage, { id: toastId });
        }
    };

    return (
        <div className="space-y-8">
            {/* ... (Success Modal and Retainer Service - unchanged) ... */}
            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#fcfbf9] rounded-sm p-8 max-w-md w-full shadow-2xl border border-ac-gold/20 relative"
                    >
                        <button
                            onClick={() => setShowSuccess(false)}
                            className="absolute top-4 right-4 text-ac-taupe/40 hover:text-ac-gold transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-ac-olive/10 flex items-center justify-center text-ac-olive mb-2">
                                <Check size={32} />
                            </div>

                            <h2 className="font-serif text-3xl text-ac-taupe">Request Received</h2>

                            <div className="space-y-2 text-sm text-ac-taupe/80 font-sans leading-relaxed">
                                <p>Thank you for your trust.</p>
                                <p>Alejandra has been notified and your request is now in her personal studio inbox.</p>
                                <p className="pt-2 text-ac-taupe/60 text-xs uppercase tracking-widest">She will be in touch shortly.</p>
                            </div>

                            <button
                                onClick={() => setShowSuccess(false)}
                                className="mt-6 px-8 py-3 bg-ac-taupe text-white text-xs font-bold uppercase tracking-widest hover:bg-ac-gold transition-colors w-full rounded-sm"
                            >
                                Return to Vault
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* 1. TOP: The Retainer Horizon (Slim Watermark) */}
            {retainerService && (
                <motion.div
                    onClick={() => handleCheckout(retainerService.price_id || '')}
                    variants={retainerVariants}
                    initial="hidden"
                    animate="show"
                    className="group relative block w-full bg-[#C5A059] rounded-sm overflow-hidden shadow-md hover:shadow-xl transition-all duration-700 h-[100px] cursor-pointer"
                >
                    {/* Watermark Background */}
                    <div className="absolute inset-0 z-0 overflow-hidden">
                        {retainerService.image_url && (
                            <motion.img
                                src={retainerService.image_url}
                                alt=""
                                initial={{ scale: 1 }}
                                whileHover={{ scale: 1.05 }}
                                transition={{ duration: 1.5 }}
                                className="w-full h-full object-cover opacity-30 mix-blend-overlay grayscale contrast-125"
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#C5A059]/95 via-[#C5A059]/80 to-[#D4B06A]/90 mix-blend-multiply" />
                    </div>

                    {/* Content - Horizontal Flex */}
                    <div className="relative z-10 h-full px-6 md:px-12 flex items-center justify-between">

                        {/* Left: Text Identity */}
                        <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-4">
                            <h2 className="font-serif text-3xl md:text-4xl text-white leading-none drop-shadow-sm">
                                {retainerService.title}
                            </h2>
                            <p className="font-serif text-white/80 italic text-xs md:text-sm tracking-wide max-w-md truncate">
                                {retainerService.description}
                            </p>
                        </div>

                        {/* Right: Commercials */}
                        <div className="flex items-center gap-4 md:gap-8">
                            <div className="flex flex-col items-end">
                                <span className="font-sans font-bold text-white tracking-widest text-sm md:text-lg drop-shadow-sm">
                                    {retainerService.price_display}
                                </span>
                            </div>

                            <div className="hidden md:flex flex-col items-end gap-1">
                                <div className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center group-hover:bg-white group-hover:text-[#C5A059] transition-all text-white">
                                    <ArrowUpRight size={16} />
                                </div>
                                <span className="text-[9px] uppercase tracking-widest text-white/60 group-hover:text-white transition-opacity">
                                    {t('apply_retainer')}
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}


            {/* 2. MIDDLE: Session Modules */}
            <div>
                {/* Recommendation Note (Floating - tightly coupled) */}
                {recommendedServiceId && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8, duration: 0.6 }}
                        className="flex justify-center mb-4"
                    >
                        <div className="bg-white/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-ac-gold/20 flex items-center gap-2 shadow-sm text-center">
                            <Sparkles size={12} className="text-ac-gold" />
                            <p className="font-serif text-ac-taupe italic text-xs">
                                {recommendationReason || 'Recommended for your essence.'}
                            </p>
                        </div>
                    </motion.div>
                )}

                <motion.div
                    variants={gridContainerVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "0px" }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr"
                >
                    {sessionServices.map((service) => {
                        const isRecommended = service.id === recommendedServiceId;

                        return (
                            <motion.div
                                key={service.id}
                                onClick={() => handleCheckout(service.price_id || '')}
                                variants={cardVariants}
                                className={`group relative flex flex-col bg-white/40 backdrop-blur-md rounded-sm overflow-visible border transition-all duration-500 hover:shadow-lg cursor-pointer h-full ${isRecommended
                                    ? 'border-ac-gold shadow-md ring-1 ring-ac-gold/20 z-10'
                                    : 'border-white/30 hover:border-ac-taupe/20'
                                    }`}
                            >
                                {/* Flexible Layout: Image fixed height, Content grows */}
                                <div className="h-64 overflow-hidden relative bg-ac-taupe/10 flex-shrink-0">
                                    {service.image_url ? (
                                        <img
                                            src={service.image_url}
                                            alt={service.title}
                                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-ac-taupe/5">
                                            <span className="font-serif italic text-ac-taupe/20">{t('title')}</span>
                                        </div>
                                    )}

                                    {/* Price Tag (Top Right - Mini) */}
                                    <div className="absolute top-2 right-2 bg-white/95 backdrop-blur text-ac-taupe font-sans text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm">
                                        {service.price_display}
                                    </div>

                                    {isRecommended && (
                                        <div className="absolute top-2 left-2 bg-ac-gold text-white text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-sm shadow-sm">
                                            {t('suggested')}
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 flex flex-col flex-1 relative">
                                    <div className="mb-4">
                                        <h3 className="font-serif text-xl md:text-2xl text-ac-taupe leading-tight transition-colors group-hover:text-ac-olive mb-1">
                                            {service.title}
                                        </h3>
                                        {service.subtitle && (
                                            <p className="font-serif text-ac-taupe/60 italic text-xs">
                                                {service.subtitle}
                                            </p>
                                        )}
                                    </div>

                                    <div className="h-px w-6 bg-ac-taupe/20 mb-4 group-hover:w-full transition-all duration-700" />

                                    <div className="font-sans text-ac-taupe/80 text-xs leading-relaxed whitespace-pre-wrap flex-1 mb-6">
                                        {service.description}
                                    </div>

                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-ac-taupe/10">

                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] uppercase tracking-widest text-ac-taupe/40 group-hover:text-ac-gold transition-opacity decoration-clone">
                                                {t('secure_session')}
                                            </span>
                                            <ArrowUpRight size={14} className="text-ac-taupe/40 group-hover:text-ac-gold group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>

            {/* 3. BOTTOM: Concierge & Corporate */}
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="text-center pt-16 border-t border-ac-taupe/5 space-y-8"
            >
                <a
                    href="https://wa.me/13054131472"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-8 py-3 rounded-full border border-ac-gold text-ac-gold hover:bg-ac-gold hover:text-white transition-all duration-300 group"
                >
                    <span className="uppercase tracking-widest text-xs font-bold">{t('whatsapp')}</span>
                </a>

                <p className="text-ac-taupe/40 text-[10px] md:text-xs font-sans tracking-[0.2em] uppercase">
                    {t('corporate')} <a href="mailto:hello@acstyling.com" className="hover:text-ac-taupe transition-colors">hello@acstyling.com</a>
                </p>
            </motion.div>
        </div>
    );
}
