"use client";

import { useState } from "react";
import { CheckCircle, ArrowRight, PlayCircle, BookOpen } from "lucide-react";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface MarkCompleteProps {
    slug: string;
    isCompletedInitial: boolean;
    nextChapterSlug: string | null;
    baseRoute?: string;
}

export default function MarkComplete({ slug, isCompletedInitial, nextChapterSlug, baseRoute = "/vault/foundations" }: MarkCompleteProps) {
    // If it was already completed in the DB, the video is considered completed.
    const [isVideoCompleted, setIsVideoCompleted] = useState(isCompletedInitial);

    const handleVideoComplete = () => {
        if (isVideoCompleted) return;
        setIsVideoCompleted(true);
        toast.success("Video Completed!", {
            description: "You have unlocked the Essence Lab for this chapter.",
            duration: 3000,
        });
    };

    return (
        <div className="w-full md:w-auto flex flex-col gap-3 min-w-[280px]">
            {/* 1. Video Completion Button */}
            <AnimatePresence mode="wait">
                {isVideoCompleted ? (
                    <motion.div
                        key="completed"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 text-ac-olive bg-ac-olive/10 px-6 py-4 rounded-sm border border-ac-olive/20 w-full justify-center cursor-default"
                    >
                        <CheckCircle size={20} />
                        <span className="text-sm font-bold uppercase tracking-widest">
                            {isCompletedInitial ? "Chapter Mastered" : "Video Completed"}
                        </span>
                    </motion.div>
                ) : (
                    <motion.button
                        key="mark-complete"
                        layout
                        onClick={handleVideoComplete}
                        className="group flex items-center justify-between gap-4 w-full bg-ac-taupe text-white py-4 px-8 rounded-sm hover:bg-ac-taupe/90 transition-all shadow-md"
                    >
                        <span className="font-serif text-lg tracking-wide flex items-center gap-2">
                            <PlayCircle size={20} />
                            Mark Video Complete
                        </span>
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* 2. Essence Lab Access Button */}
            {isVideoCompleted ? (
                <Link
                    href={`${baseRoute}/${slug}/essence-lab`}
                    className="group flex items-center justify-between gap-4 w-full bg-ac-gold text-white py-4 px-8 rounded-sm hover:bg-ac-gold/90 transition-all shadow-md"
                >
                    <span className="font-serif text-lg tracking-wide flex items-center gap-2">
                        <BookOpen size={20} />
                        Go to Essence Lab
                    </span>
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
            ) : (
                <div
                    className="flex items-center justify-between gap-4 w-full bg-ac-taupe/10 text-ac-taupe/50 py-4 px-8 rounded-sm cursor-not-allowed border border-ac-taupe/10"
                >
                    <span className="font-serif text-lg tracking-wide flex items-center gap-2">
                        <BookOpen size={20} />
                        Essence Lab Locked
                    </span>
                </div>
            )}
        </div>
    );
}
