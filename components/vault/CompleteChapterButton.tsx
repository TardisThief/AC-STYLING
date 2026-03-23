"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { getEssenceProgress, checkIncompleteMasterclassLabs } from "@/app/actions/essence-lab";
import { ArrowRight, Loader2 } from "lucide-react";
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCompleted, setIsCompleted] = useState(isCompletedInitial);
    const [hasMissingLabs, setHasMissingLabs] = useState(false);

    useEffect(() => {
        if (!nextChapterSlug) {
            checkIncompleteMasterclassLabs(chapterId).then(setHasMissingLabs);
        }
    }, [chapterId, nextChapterSlug]);

    const supabase = createClient();
    const router = useRouter();

    const handleComplete = async () => {
        setIsSubmitting(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        let isMastered = isCompleted; // Use local state for current completion status

        if (!isMastered && totalQuestions > 0) {
            // Fetch responses and count in JS to avoid JSONB string query issues
            const { data: responses } = await supabase
                .from('essence_responses')
                .select('answer_value')
                .eq('user_id', user.id)
                .eq('chapter_id', chapterId);
            
            let answeredCount = 0;
            if (responses) {
                answeredCount = responses.filter(r => {
                    const val = r.answer_value;
                    if (!val) return false;
                    if (typeof val === 'string' && val.trim() === '') return false;
                    return true;
                }).length;
            }

            if (answeredCount >= totalQuestions) {
                isMastered = true;
            }
        } else if (!isMastered && totalQuestions === 0) {
            // Master automatically if no questions
            isMastered = true;
        }

        if (isMastered && !isCompleted) { // Check against local state
            // Check if progress row already exists before inserting
            const contentId = baseRoute.includes('courses') ? `courses/${slug}` : `foundations/${slug}`;
            const { data: existingProgress } = await supabase
                .from('user_progress')
                .select('id')
                .eq('user_id', user.id)
                .eq('content_id', contentId)
                .maybeSingle();
            
            if (!existingProgress) {
                await supabase.from('user_progress').insert({
                    user_id: user.id,
                    content_id: contentId,
                    completed_at: new Date().toISOString()
                });
            }

            triggerCelebration();
            setIsCompleted(true); // Update local state
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
        setIsSubmitting(false);
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
            <div className="flex flex-col items-center gap-2 mt-4">
                <button
                    onClick={handleComplete}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 text-xs uppercase tracking-widest text-ac-taupe/60 hover:text-ac-taupe transition-colors group"
                >
                    {isSubmitting ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <>Continue to Next Chapter <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></>
                    )}
                </button>
                {!nextChapterSlug && (
                    <button
                       onClick={() => router.push('/vault/essence')}
                       className="text-[10px] uppercase tracking-widest text-ac-gold hover:text-ac-olive transition-colors"
                    >
                       {hasMissingLabs ? "Review & Complete Missing Answers" : "Review your Essence Journal"}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center">
            <motion.button
                layout
                onClick={handleComplete}
                disabled={isSubmitting}
                className="group flex flex-col items-center justify-center gap-1 w-full md:w-auto bg-ac-olive text-white py-4 px-12 rounded-sm hover:bg-ac-olive/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mx-auto min-w-[300px]"
            >
                {isSubmitting ? (
                    <span className="flex items-center gap-2 font-serif tracking-wide">
                        <Loader2 className="animate-spin" size={16} /> Finalizing
                    </span>
                ) : (
                    <>
                        <span className="flex items-center gap-2 mb-1 font-serif tracking-wide text-lg">
                            {nextChapterSlug ? 'Complete & Master Chapter' : 'Master Masterclass'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                        {isCompleted && <span className="text-[10px] text-white/70 font-sans tracking-widest uppercase">(Already Mastered)</span>}
                    </>
                )}
            </motion.button>
            {!nextChapterSlug && (
                <button
                    onClick={() => router.push('/vault/essence')}
                    className="text-[10px] uppercase tracking-widest text-ac-taupe/60 hover:text-ac-gold transition-colors mt-3"
                >
                    {hasMissingLabs ? "Review & Complete Missing Answers" : "Review your Essence Journal"}
                </button>
            )}
        </div>
    );
}
