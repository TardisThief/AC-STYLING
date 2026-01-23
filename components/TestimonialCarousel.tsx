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

    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            nextSlide();
        }, 5000);
        return () => clearInterval(timer);
    }, [currentIndex, isPaused]);

    const nextSlide = () => {
        setDirection(1);
        setCurrentIndex((prev) => (prev + 1) % items.length);
    };

    const prevSlide = () => {
        setDirection(-1);
        setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 100 : -100,
            opacity: 0,
            scale: 0.95
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 100 : -100,
            opacity: 0,
            scale: 0.95
        })
    };

    const currentTestimonial = items[currentIndex];

    return (
        <div
            className="relative w-full max-w-3xl mx-auto px-4 md:px-12"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div className="relative overflow-hidden min-h-[400px] flex items-center justify-center">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                    <motion.div
                        key={currentIndex}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                        }}
                        className="w-full"
                    >
                        <div className="bg-white/80 backdrop-blur-md border border-white/40 shadow-sm p-8 md:p-12 rounded-2xl relative flex flex-col items-center text-center">
                            <div className="flex gap-1 mb-6">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                ))}
                            </div>

                            <p className="font-serif text-xl md:text-2xl leading-relaxed text-ac-taupe mb-8 italic">
                                "{currentTestimonial.text}"
                            </p>

                            <div>
                                <p className="font-bold text-ac-taupe text-lg uppercase tracking-wide">
                                    {currentTestimonial.name}
                                </p>
                                <p className="text-gray-500 text-sm uppercase tracking-wider mt-1">
                                    {currentTestimonial.location}
                                </p>
                            </div>

                            <Quote className="absolute top-8 left-8 w-10 h-10 text-ac-taupe/5 rotate-180" />
                            <Quote className="absolute bottom-8 right-8 w-10 h-10 text-ac-taupe/5" />
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Controls */}
            <button
                onClick={prevSlide}
                className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-ac-taupe/50 hover:text-ac-taupe transition-colors"
                aria-label="Previous testimonial"
            >
                <ChevronLeft size={32} />
            </button>
            <button
                onClick={nextSlide}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-ac-taupe/50 hover:text-ac-taupe transition-colors"
                aria-label="Next testimonial"
            >
                <ChevronRight size={32} />
            </button>

            {/* Indicators */}
            <div className="flex justify-center gap-2 mt-8">
                {items.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => {
                            setDirection(idx > currentIndex ? 1 : -1);
                            setCurrentIndex(idx);
                        }}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentIndex ? "bg-ac-taupe w-8" : "bg-ac-taupe/30"
                            }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
