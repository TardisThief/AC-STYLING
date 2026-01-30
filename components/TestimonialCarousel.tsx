"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";


interface Testimonial {
    name: string;
    location: string;
    text: string;
}

interface TestimonialCarouselProps {
    items: Testimonial[];
}

export default function TestimonialCarousel({ items }: TestimonialCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Speed optimization: 4.5s for "slightly above average reading speed" per set of cards.
    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            nextSlide();
        }, 4500);
        return () => clearInterval(timer);
    }, [currentIndex, isPaused]);

    const nextSlide = () => {
        setDirection(1);
        setCurrentIndex((prev) => (prev + 2) % items.length);
    };

    const prevSlide = () => {
        setDirection(-1);
        setCurrentIndex((prev) => (prev - 2 + items.length) % items.length);
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 50 : -50,
            opacity: 0,
        })
    };

    // Get the two cards to display (current and next, wrapping around)
    const card1 = items[currentIndex];
    const card2 = items[(currentIndex + 1) % items.length];

    return (
        <div
            className="relative w-full max-w-5xl mx-auto px-4 md:px-12"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div className="relative overflow-hidden min-h-[350px] flex items-center justify-center">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={currentIndex}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.3 }
                        }}
                        className="w-full grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                        {/* Card 1 */}
                        <TestimonialCard testimonial={card1} />

                        {/* Card 2 (Hidden on mobile if we only want 1 there, or shown? User asked for 2 cards. Standard is 1 mobile / 2 desktop) */}
                        <div className="hidden md:block">
                            <TestimonialCard testimonial={card2} />
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Controls */}
            <button
                onClick={prevSlide}
                className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-ac-taupe/50 hover:text-ac-taupe transition-colors z-10"
                aria-label="Previous testimonial"
            >
                <ChevronLeft size={32} />
            </button>
            <button
                onClick={nextSlide}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-ac-taupe/50 hover:text-ac-taupe transition-colors z-10"
                aria-label="Next testimonial"
            >
                <ChevronRight size={32} />
            </button>

            {/* Indicators */}
            <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: Math.ceil(items.length / 2) }).map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => {
                            const newIndex = idx * 2;
                            setDirection(newIndex > currentIndex ? 1 : -1);
                            setCurrentIndex(newIndex);
                        }}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${Math.floor(currentIndex / 2) === idx ? "bg-ac-taupe w-8" : "bg-ac-taupe/30"
                            }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
    return (
        <div className="bg-white/80 backdrop-blur-md border border-white/40 shadow-sm p-8 rounded-2xl relative flex flex-col items-center text-center h-full justify-between">
            <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                ))}
            </div>

            <p className="font-serif text-lg leading-relaxed text-ac-taupe mb-6 italic line-clamp-4">
                "{testimonial.text}"
            </p>

            <div>
                <p className="font-bold text-ac-taupe text-base uppercase tracking-wide">
                    {testimonial.name}
                </p>
                <p className="text-gray-500 text-xs uppercase tracking-wider mt-1">
                    {testimonial.location}
                </p>
            </div>

            <Quote className="absolute top-6 left-6 w-8 h-8 text-ac-taupe/5 rotate-180" />
        </div>
    );
}
