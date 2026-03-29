"use client";

import Image from 'next/image';
import React from 'react';
import { motion } from 'framer-motion';

const TrustedBy = () => {
    // Generate array of 12 partner items with specific order
    const partnerOrder = [12, 2, 5, 6, 8, 1, 3, 4, 7, 9, 10, 11];

    const originalPartners = partnerOrder.map((id) => ({
        id,
        src: `/partner ${id}.png`,
        alt: `Partner ${id}`,
    }));

    // Duplicate the array to create a seamless loop
    const partners = [...originalPartners, ...originalPartners];

    return (
        <section className="w-full py-12 md:py-16 bg-white overflow-hidden">
            <div className="container-fluid">
                {/* Heading */}
                <h3 className="text-center text-sm font-medium tracking-[0.2em] text-gray-500 mb-8 md:mb-12 uppercase">
                    Trusted By
                </h3>

                {/* Carousel Configuration */}
                <div className="relative w-full flex overflow-hidden mask-linear-fade">
                    <motion.div
                        className="flex items-center gap-12 md:gap-24 pr-12 md:pr-24"
                        animate={{
                            x: ["0%", "-50%"],
                        }}
                        transition={{
                            x: {
                                repeat: Infinity,
                                repeatType: "loop",
                                duration: 40, // Adjust speed here (higher = slower)
                                ease: "linear",
                            },
                        }}
                    >
                        {partners.map((partner, index) => (
                            <div
                                // Use index in key because IDs are duplicated
                                key={`${partner.id}-${index}`}
                                className="relative flex-shrink-0 flex justify-center items-center group cursor-pointer"
                            >
                                <div className="relative h-12 w-[120px] transition-all duration-300 filter grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100">
                                    <Image
                                        src={partner.src}
                                        alt={partner.alt}
                                        fill
                                        className="object-contain"
                                        sizes="120px"
                                    />
                                </div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default TrustedBy;
