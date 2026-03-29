"use client";

import Image from 'next/image';
import { motion } from 'framer-motion';

interface Logo {
    id: string | number;
    src: string;
    alt: string;
}

export default function TrustedByCarousel({ logos }: { logos: Logo[] }) {
    // Duplicate for seamless loop
    const items = [...logos, ...logos];

    return (
        <div className="relative w-full flex overflow-hidden mask-linear-fade">
            <motion.div
                className="flex items-center gap-12 md:gap-24 pr-12 md:pr-24"
                animate={{ x: ["0%", "-50%"] }}
                transition={{
                    x: {
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 40,
                        ease: "linear",
                    },
                }}
            >
                {items.map((logo, index) => (
                    <div
                        key={`${logo.id}-${index}`}
                        className="relative flex-shrink-0 flex justify-center items-center group cursor-pointer"
                    >
                        <div className="relative h-12 w-[120px] transition-all duration-300 filter grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100">
                            <Image
                                src={logo.src}
                                alt={logo.alt}
                                fill
                                className="object-contain"
                                sizes="120px"
                            />
                        </div>
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
