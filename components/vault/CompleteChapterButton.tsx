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
    nextChapterSlug: string | null;
    isCompletedInitial: boolean;
    baseRoute?: string;
}

export default function CompleteChapterButton({ slug, nextChapterSlug, isCompletedInitial, baseRoute = "/vault/foundations" }: CompleteChapterButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const handleComplete = async () => {
        setIsLoading(true);

        if (!isCompletedInitial) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('user_progress').insert({
                    user_id: user.id,
                    content_id: `foundations/${slug}` // Shared id format
                });
            }
        }

        triggerCelebration();

        if (nextChapterSlug) {
            toast.success("Chapter Mastered!", {
                description: "Ready for your next style distillation?",
                action: {
                    label: "Next Lesson",
                    onClick: () => router.push(`${baseRoute}/${nextChapterSlug}`)
                },
                duration: 5000,
            });
            router.push(`${baseRoute}/${nextChapterSlug}`);
        } else {
            toast.success("All Chapters Mastered!", {
                description: "You have completed this collection.",
                duration: 5000,
            });
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

    return (
        <motion.button
            layout
            onClick={handleComplete}
            disabled={isLoading}
            className="group flex items-center justify-between gap-6 w-full md:w-auto bg-ac-olive text-white py-4 px-12 rounded-sm hover:bg-ac-olive/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
        >
            <span className="font-serif text-lg tracking-wide">
                {isLoading ? "Finalizing..." : "Complete & Master Chapter"}
            </span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </motion.button>
    );
}
