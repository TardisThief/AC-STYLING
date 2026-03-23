"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface CompleteChapterButtonProps {
    slug: string;
    chapterId: string;
    totalQuestions: number;
    nextChapterSlug: string | null;
    isCompletedInitial: boolean;
    baseRoute?: string;
    variant?: "default" | "subtle";
}

export default function CompleteChapterButton({ slug, chapterId, totalQuestions, nextChapterSlug, isCompletedInitial, baseRoute = "/vault/foundations", variant = "default" }: CompleteChapterButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const handleComplete = async () => {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        let isMastered = isCompletedInitial;

        if (!isMastered && totalQuestions > 0) {
            // Check if all questions are answered
            const { count } = await supabase
                .from('essence_responses')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('chapter_id', chapterId)
                .not('answer_value', 'is', null) // Avoid empty answers if possible
                .neq('answer_value', ''); // Ensure not empty string

            if (count !== null && count >= totalQuestions) {
                isMastered = true;
                await supabase.from('user_progress').insert({
                    user_id: user.id,
                    content_id: `foundations/${slug}` // Shared id format
                });
            }
        } else if (!isMastered && totalQuestions === 0) {
            // Master automatically if no questions
            isMastered = true;
            await supabase.from('user_progress').insert({
                user_id: user.id,
                content_id: `foundations/${slug}`
            });
        }

        if (isMastered && !isCompletedInitial) {
            triggerCelebration();
            if (nextChapterSlug) {
                toast.success("Chapter Mastered!", {
                    description: "Excellent work completing the essence lab.",
                    duration: 3000,
                });
            } else {
                toast.success("All Chapters Mastered!", {
                    description: "You have completed this collection.",
                    duration: 5000,
                });
            }
        }

        // Navigate forward
        if (nextChapterSlug) {
            router.push(`${baseRoute}/${nextChapterSlug}`);
        } else {
            router.push(baseRoute === "/vault/courses" ? "/vault/courses" : "/vault/foundations");
        }
    };

    const triggerCelebration = () => {
        const colors = ['#D4AF37', '#7F8968', '#FFFFFF'];
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: colors,
            disableForReducedMotion: true
        });
    };

    if (variant === "subtle") {
        return (
            <button
                onClick={handleComplete}
                disabled={isLoading}
                className="flex items-center gap-2 text-sm uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors group disabled:opacity-50"
            >
                {isLoading ? "Loading..." : "Continue to Next Chapter"}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
        );
    }

    return (
        <motion.button
            layout
            onClick={handleComplete}
            disabled={isLoading}
            className="group flex items-center justify-between gap-6 w-full md:w-auto bg-ac-olive text-white py-3 px-8 rounded-sm hover:bg-ac-olive/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
        >
            <span className="font-serif tracking-wide">
                {isLoading ? "Saving..." : "Continue to Next Chapter"}
            </span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </motion.button>
    );
}
