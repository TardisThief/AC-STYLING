"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle, ArrowRight, Check } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface MarkCompleteProps {
    slug: string;
    isCompletedInitial: boolean;
    nextChapterSlug: string | null;
}

export default function MarkComplete({ slug, isCompletedInitial, nextChapterSlug }: MarkCompleteProps) {
    const [isCompleted, setIsCompleted] = useState(isCompletedInitial);
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const handleComplete = async () => {
        if (isCompleted) return;
        setIsLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('user_progress').insert({
            user_id: user.id,
            content_id: `foundations/${slug}`
        });

        if (!error) {
            setIsCompleted(true);
            triggerCelebration();

            if (nextChapterSlug) {
                toast.success("Session Completed!", {
                    description: "Ready for your next style distillation?",
                    action: {
                        label: "Next Lesson",
                        onClick: () => router.push(`/vault/foundations/${nextChapterSlug}`)
                    },
                    duration: 5000,
                });
            } else {
                toast.success("All Chapters Completed!", {
                    description: "You have mastered this collection.",
                    duration: 5000,
                });
                // Redirect to a summary page or back to foundations if no next chapter
                // router.push('/vault/essence-summary'); // Or just stay/refresh
            }

            router.refresh();
        }
        setIsLoading(false);
    };

    const triggerCelebration = () => {
        // Luxury Confetti: Gold and Taupe
        const colors = ['#D4AF37', '#7F8968', '#FFFFFF'];
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: colors,
            disableForReducedMotion: true
        });
    };

    return (
        <div className="w-full md:w-auto">
            <AnimatePresence mode="wait">
                {isCompleted ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 text-ac-olive bg-ac-olive/10 px-6 py-4 rounded-sm border border-ac-olive/20 w-full md:w-fit justify-center cursor-default"
                    >
                        <CheckCircle size={20} />
                        <span className="text-sm font-bold uppercase tracking-widest">Mastered</span>
                    </motion.div>
                ) : (
                    <motion.button
                        layout
                        onClick={handleComplete}
                        disabled={isLoading}
                        className="group flex items-center justify-between gap-4 w-full bg-ac-taupe text-white py-4 px-8 rounded-sm hover:bg-ac-taupe/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="font-serif text-lg tracking-wide">
                            {isLoading ? "Saving..." : "Mark as Complete"}
                        </span>
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
