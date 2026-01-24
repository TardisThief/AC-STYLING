"use client";

import { motion } from "framer-motion";

export default function VaultHero({ userName = "Guest" }: { userName?: string }) {
    return (
        <section className="mb-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="mb-8"
            >
                <h1 className="font-serif text-4xl md:text-5xl text-ac-taupe mb-2">
                    Welcome back, {userName}
                </h1>
                <p className="font-sans text-ac-coffee/80 tracking-wide uppercase text-sm">
                    Your Personal Style Dashboard
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                className="relative w-full overflow-hidden rounded-sm shadow-lg group cursor-pointer"
                style={{ aspectRatio: "21/9" }} // Desktop default, overridden by class for mobile if needed, but Tailwind is better.
            >
                {/* Mobile Aspect Ratio Wrapper - using Tailwind classes for different ratios */}
                <div className="absolute inset-0 block md:hidden bg-ac-taupe/10 aspect-[3/4]">
                    {/* Placeholder for Mobile Image */}
                    <div className="absolute inset-0 bg-gradient-to-t from-ac-taupe/90 to-transparent z-10" />
                    <img
                        src="/images/vault-hero-mobile.jpg"
                        alt="What's New"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1490481651871-ab52661227ed?q=80&w=2070&auto=format&fit=crop'; // Fallback
                        }}
                    />
                </div>

                {/* Desktop Image */}
                <div className="absolute inset-0 hidden md:block">
                    <div className="absolute inset-0 bg-gradient-to-r from-ac-taupe/80 to-transparent z-10" />
                    <img
                        src="/images/vault-hero-desktop.jpg"
                        alt="What's New"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070&auto=format&fit=crop'; // Fallback
                        }}
                    />
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 p-8 z-20 text-white max-w-md">
                    <span className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-widest uppercase bg-ac-gold/90 text-white backdrop-blur-sm">
                        Editorial
                    </span>
                    <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-4">
                        The Spring '26 Capsule: Refined utility for the modern nomad.
                    </h2>
                    <span className="inline-flex items-center text-sm font-bold tracking-widest uppercase border-b border-whitepb-1 hover:text-ac-beige transition-colors">
                        Explore the Collection
                    </span>
                </div>
            </motion.div>
            {/* Simple fix to enforce aspect ratio via container visibility if needed, 
                 but for simplicity, I'm relying on the inner absolute divs to switch. 
                 To conform strictly to the 3:4 (mobile) vs 21:9 (desktop) requirement:
             */}
            <style jsx>{`
                @media (max-width: 768px) {
                    .relative { aspect-ratio: 3/4 !important; }
                }
             `}</style>
        </section>
    );
}
