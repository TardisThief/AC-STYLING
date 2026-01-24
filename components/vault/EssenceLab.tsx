"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Sparkles, Loader2, Check } from "lucide-react";

interface EssenceLabProps {
    slug: string;
    initialData: Record<string, any>;
    questions?: Array<{ key: string, label: string, placeholder: string }>;
}

// Configuration for questions per chapter (fallback)
const questionsMap: Record<string, { key: string; label: string; placeholder: string }[]> = {
    'dna': [
        { key: 'style_words', label: 'My 3 Style Words', placeholder: 'E.g., Effortless, Structural, Warm...' },
        { key: 'style_mood', label: 'Current Style Mood', placeholder: 'How do you want to feel every day?' }
    ],
    'architecture': [
        { key: 'best_feature', label: 'Best Feature to Emphasize', placeholder: 'E.g., Shoulders, Waist, Legs...' },
        { key: 'proportion_goal', label: 'Proportion Goal', placeholder: 'What silhouette balance are you aiming for?' }
    ],
    'color': [
        { key: 'power_color', label: 'Power Color', placeholder: 'The color that makes you feel unstoppable...' },
        { key: 'neutral_base', label: 'Neutral Base', placeholder: 'Your go-to neutral (e.g., Navy, Camel, Charcoal)...' }
    ],
    'detox': [
        { key: 'detox_goal', label: 'Detox Goal', placeholder: 'What is the main outcome you want from this edit?' },
        { key: 'items_to_purge', label: 'Categories to Review', placeholder: 'E.g., Old denim, unused shoes...' }
    ],
    'capsule': [
        { key: 'capsule_theme', label: 'Capsule Theme', placeholder: 'Name your capsule (e.g., Summer in the City)...' },
        { key: 'core_pieces', label: 'Key Investment Pieces', placeholder: 'List 3 items you need to acquire...' }
    ]
};

export default function EssenceLab({ slug, initialData, questions: propQuestions }: EssenceLabProps) {
    // Use provided questions or fall back to hardcoded map
    const questions = propQuestions || questionsMap[slug] || [];
    const supabase = createClient();
    const [answers, setAnswers] = useState<Record<string, string>>(initialData || {});
    const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

    const handleChange = (key: string, value: string) => {
        setAnswers(prev => ({ ...prev, [key]: value }));
        setSavingStatus(prev => ({ ...prev, [key]: 'idle' }));
    };

    const handleBlur = async (key: string, value: string) => {
        // Only save if dirty? For simplicity, save on every blur for now to ensure persistence.
        setSavingStatus(prev => ({ ...prev, [key]: 'saving' }));

        // Merge with existing data
        const newData = { ...initialData, ...answers, [key]: value };

        const { error } = await supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) return { error: 'No user' };
            return supabase.from('profiles').update({
                style_essentials: newData
            }).eq('id', user.id);
        });

        if (!error) {
            setSavingStatus(prev => ({ ...prev, [key]: 'saved' }));
            setTimeout(() => {
                setSavingStatus(prev => ({ ...prev, [key]: 'idle' }));
            }, 2000);
        } else {
            setSavingStatus(prev => ({ ...prev, [key]: 'idle' })); // or error state
            console.error("Failed to save:", error);
        }
    };

    if (questions.length === 0) return null;

    return (
        <div className="bg-white/20 backdrop-blur-md border border-white/30 p-6 rounded-sm shadow-sm">
            <div className="flex items-center gap-2 mb-6">
                <Sparkles className="text-ac-gold" size={20} />
                <h3 className="font-serif text-xl text-ac-taupe">Styling Essence Lab</h3>
            </div>

            <div className="space-y-6">
                {questions.map((q) => (
                    <div key={q.key}>
                        <div className="flex justify-between items-baseline mb-2">
                            <label htmlFor={q.key} className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                                {q.label}
                            </label>
                            {savingStatus[q.key] === 'saving' && <Loader2 size={12} className="text-ac-gold animate-spin" />}
                            {savingStatus[q.key] === 'saved' && <Check size={12} className="text-ac-olive" />}
                        </div>

                        <textarea
                            id={q.key}
                            value={answers[q.key] || ''}
                            onChange={(e) => handleChange(q.key, e.target.value)}
                            onBlur={(e) => handleBlur(q.key, e.target.value)}
                            placeholder={q.placeholder}
                            rows={3}
                            className="w-full bg-white/40 border border-white/50 rounded-sm p-3 text-sm text-ac-taupe placeholder:text-ac-taupe/40 focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold transition-all resize-none font-serif"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
