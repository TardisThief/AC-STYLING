"use client";

import { useState, useEffect } from "react";
import { getOffer } from "@/app/actions/admin/manage-offers";
import { createCheckoutSession } from "@/app/actions/stripe";
import { toast } from "sonner";
import { Loader2, Sparkles, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FullAccessUnlock({ userId, hasFullAccess }: { userId?: string, hasFullAccess: boolean }) {
    const [offer, setOffer] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { offer } = await getOffer('full_access');
            if (offer && offer.active) {
                setOffer(offer);
            }
        };
        load();
    }, []);

    // Don't show if user already has full access or if no offer exists
    if (hasFullAccess || !offer) return null;

    const handlePurchase = async () => {
        if (!userId) {
            toast.error("Please log in to purchase.");
            return;
        }

        setLoading(true);
        try {
            // Determine return URL
            const returnUrl = `/vault/foundations`;

            const result = await createCheckoutSession(offer.price_id, returnUrl);

            if (result.error) {
                toast.error(result.error);
            } else if (result.url) {
                window.location.href = result.url; // Redirect to Stripe
            }
        } catch (error) {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Trigger Button - Floating or Inline? Let's make it a nice banner first, or a button in the header? */}
            {/* Placing it as a card in the grid is also an option, but sticky/floating or header banner is better */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 mb-12 p-1"
            >
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-full relative overflow-hidden group rounded-sm bg-gradient-to-r from-ac-gold/20 to-ac-taupe/10 border border-ac-gold/30 hover:border-ac-gold/60 p-6 md:p-8 transition-all duration-500"
                >
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-left">
                            <h3 className="font-serif text-2xl md:text-3xl text-ac-taupe flex items-center gap-3">
                                <Sparkles className="text-ac-gold" size={24} />
                                {offer.title}
                            </h3>
                            <p className="text-ac-taupe/60 mt-2 max-w-xl">
                                {offer.description || "Unlock everything at once."}
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="bg-ac-gold text-white px-8 py-3 rounded-sm font-bold tracking-widest uppercase hover:bg-ac-gold/80 transition-colors shadow-lg group-hover:shadow-ac-gold/20">
                                Unlock Now • {offer.price_display}
                            </div>
                            <span className="text-[10px] uppercase tracking-widest text-ac-taupe/40">Limited Availability</span>
                        </div>
                    </div>
                </button>
            </motion.div>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative w-full max-w-lg bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl rounded-sm overflow-hidden"
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 text-ac-taupe/40 hover:text-ac-taupe z-20"
                            >
                                <X size={24} />
                            </button>

                            {/* Modal Content */}
                            <div className="p-8 md:p-12 text-center">
                                <div className="w-16 h-16 bg-ac-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Sparkles size={32} className="text-ac-gold" />
                                </div>
                                <h2 className="font-serif text-3xl text-ac-taupe mb-4">{offer.title}</h2>
                                <p className="text-ac-coffee/80 leading-relaxed mb-8">
                                    {offer.description} <br />
                                    <span className="text-xs text-ac-taupe/40 mt-2 block">
                                        Includes instant access to all existing and future Masterclasses.
                                    </span>
                                </p>

                                <div className="space-y-4">
                                    <button
                                        onClick={handlePurchase}
                                        disabled={loading}
                                        className="w-full bg-ac-taupe text-white py-4 text-sm font-bold uppercase tracking-widest rounded-sm hover:bg-ac-taupe/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : null}
                                        {loading ? 'Processing...' : `Purchase Full Access • ${offer.price_display}`}
                                    </button>
                                    <p className="text-[10px] text-ac-taupe/40">
                                        Secure payment via Stripe. One-time payment.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
