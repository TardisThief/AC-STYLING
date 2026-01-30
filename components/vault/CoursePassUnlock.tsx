"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createCheckoutSession } from "@/app/actions/stripe";
import { getOffer } from "@/app/actions/admin/manage-offers";
import { Sparkles, X, CheckCircle2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";

export default function CoursePassUnlock({ userId, hasCoursePass }: { userId?: string, hasCoursePass: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const [offer, setOffer] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchOffer = async () => {
            const res = await getOffer('course_pass');
            if (res.success && res.offer && res.offer.active) {
                setOffer(res.offer);
            }
        };
        fetchOffer();
    }, []);

    if (!offer || hasCoursePass) return null;

    const handlePurchase = async () => {
        if (!userId) {
            toast.error("Please log in to purchase");
            return;
        }

        setLoading(true);
        try {
            const returnUrl = `/vault/courses`;
            const result = await createCheckoutSession(offer.price_id, returnUrl);
            if (result.url) {
                window.location.href = result.url;
            } else {
                toast.error(result.error || "Checkout failed");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Banner */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 mb-10"
            >
                <div className="bg-gradient-to-r from-ac-taupe/5 to-ac-gold/10 border border-ac-gold/20 rounded-sm p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-ac-gold/20 text-ac-gold text-xs font-bold uppercase tracking-widest rounded-full mb-3">
                            <Ticket size={14} />
                            Limited Offer
                        </div>
                        <h2 className="font-serif text-2xl md:text-3xl text-ac-taupe mb-2">
                            {offer.title}
                        </h2>
                        <p className="text-ac-taupe/60 text-sm md:text-base max-w-xl">
                            {offer.description || "Get unlimited access to all standalone courses and lessons."}
                        </p>
                    </div>
                    <div>
                        <button
                            onClick={() => setIsOpen(true)}
                            className="whitespace-nowrap bg-ac-gold text-white px-8 py-3 rounded-sm uppercase tracking-widest text-sm font-bold shadow-lg shadow-ac-gold/20 hover:bg-ac-gold/90 transition-all hover:-translate-y-0.5"
                        >
                            Unlock Now • {offer.price_display}
                        </button>
                    </div>
                </div>
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
                            className="absolute inset-0 bg-ac-taupe/60 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-[#FDFBF7] w-full max-w-lg rounded-sm shadow-2xl overflow-hidden"
                        >
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 text-ac-taupe/40 hover:text-ac-taupe transition-colors z-10"
                            >
                                <X size={24} />
                            </button>

                            <div className="p-8 md:p-10 text-center">
                                <div className="w-16 h-16 mx-auto bg-ac-gold/10 rounded-full flex items-center justify-center mb-6 text-ac-gold">
                                    <Sparkles size={32} />
                                </div>

                                <h3 className="font-serif text-3xl text-ac-taupe mb-2">{offer.title}</h3>
                                <p className="text-ac-gold font-bold text-xl mb-6">{offer.price_display}</p>

                                <div className="bg-white border border-ac-taupe/10 rounded-sm p-6 mb-8 text-left space-y-3">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 size={18} className="text-ac-gold mt-0.5" />
                                        <span className="text-sm text-ac-taupe/80">Access to all current standalone courses</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 size={18} className="text-ac-gold mt-0.5" />
                                        <span className="text-sm text-ac-taupe/80">Access to all future standalone courses</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 size={18} className="text-ac-gold mt-0.5" />
                                        <span className="text-sm text-ac-taupe/80">Support styling video library</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handlePurchase}
                                    disabled={loading}
                                    className="w-full bg-ac-gold text-white py-4 rounded-sm uppercase tracking-widest font-bold hover:bg-ac-gold/90 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Processing...' : `Purchase Pass • ${offer.price_display}`}
                                </button>

                                <p className="mt-4 text-[10px] text-ac-taupe/40 uppercase tracking-widest">
                                    Secure payment via Stripe
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
