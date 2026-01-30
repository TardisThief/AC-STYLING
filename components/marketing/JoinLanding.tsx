"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Star, Play, Check } from "lucide-react";
import Image from "next/image";

interface JoinLandingProps {
    locale: string;
}

export default function JoinLanding({ locale }: JoinLandingProps) {
    const benefits = [
        "Access to all 12 Foundation Masterclasses",
        "Personalized Essence DNA Analysis",
        "Digital Wardrobe & Outfit Planner",
        "Exclusive 'Founding Member' Badge",
        "Priority Access to 1:1 Coaching"
    ];

    return (
        <div className="min-h-screen bg-ac-sand relative overflow-hidden font-sans text-ac-taupe">
            {/* Background Elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-ac-gold/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-ac-olive/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
            </div>

            <div className="relative z-10 container mx-auto px-6 py-20 lg:py-32">
                <div className="max-w-4xl mx-auto text-center space-y-8 mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/40 backdrop-blur-md border border-white/50 text-[10px] uppercase tracking-widest font-bold text-ac-gold shadow-sm"
                    >
                        <Sparkles size={14} />
                        Limited Time Offer
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="font-serif text-5xl md:text-7xl lg:text-8xl leading-none text-ac-taupe"
                    >
                        Master Your <br />
                        <span className="italic relative inline-block">
                            Style DNA
                            <span className="absolute -bottom-2 left-0 w-full h-1 bg-ac-gold/30"></span>
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg md:text-xl text-ac-taupe/70 max-w-2xl mx-auto leading-relaxed"
                    >
                        Join the <span className="font-bold text-ac-taupe">Founding Members</span> circle.
                        Unlock the complete AC Styling curriculum, digital tools, and a community of women redefining elegance.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                    >
                        <a
                            href={`/${locale}/login?plan=founding`} // In real app, this links to Stripe/Checkout
                            className="bg-ac-taupe text-white px-8 py-4 rounded-sm font-bold uppercase tracking-widest text-xs flex items-center gap-3 hover:bg-ac-gold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                        >
                            Become a Founding Member
                            <ArrowRight size={16} />
                        </a>
                        <a
                            href="#curriculum"
                            className="px-8 py-4 rounded-sm font-bold uppercase tracking-widest text-xs text-ac-taupe hover:text-ac-gold transition-colors flex items-center gap-2"
                        >
                            <Play size={14} />
                            Preview Curriculum
                        </a>
                    </motion.div>
                </div>

                {/* Glass Card - Value Prop */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="bg-white/30 backdrop-blur-xl border border-white/40 p-8 md:p-12 rounded-sm shadow-2xl relative overflow-hidden"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <h2 className="font-serif text-3xl md:text-4xl text-ac-taupe">
                                Everything you need to <br />
                                <span className="italic text-ac-gold">transform your wardrobe.</span>
                            </h2>
                            <ul className="space-y-4">
                                {benefits.map((benefit, i) => (
                                    <li key={i} className="flex items-center gap-4 text-ac-taupe/80">
                                        <div className="w-6 h-6 rounded-full bg-ac-olive/10 flex items-center justify-center text-ac-olive shrink-0">
                                            <Check size={14} strokeWidth={3} />
                                        </div>
                                        <span className="text-sm font-medium">{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative aspect-square md:aspect-[4/5] bg-ac-taupe/5 rounded-sm overflow-hidden border border-white/50">
                            {/* Placeholder for Hero Image - In production we'd use a real asset */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-ac-taupe/20">
                                <span className="font-serif text-6xl italic opacity-20">AC</span>
                                <p className="text-[10px] uppercase tracking-widest mt-4 opacity-40">Style Vault Interface</p>
                            </div>

                            {/* Floating Elements (Mock UI) */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute top-10 right-10 bg-white/80 backdrop-blur-md p-4 rounded-sm shadow-lg border border-white"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-ac-gold/20 rounded-full flex items-center justify-center">
                                        <Star size={16} className="text-ac-gold fill-ac-gold" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-ac-taupe/40">Essence Type</p>
                                        <p className="font-serif text-lg text-ac-taupe">Dramatic Classic</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
