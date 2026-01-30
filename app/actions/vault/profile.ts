'use server';

import { createClient } from '@/utils/supabase/server';

export interface StyleEssentials {
    styleWords: string[];
    archetype: string[];
    powerFeatures: { label: string, value: string }[];
    colorEnergy: { label: string, value: string }[];
}

export async function getProfileHubData() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // 1. Fetch Profile (Access Control & Name)
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    // 2. Fetch Measurements (Tailor Card)
    const { data: tailorCard } = await supabase
        .from('tailor_cards')
        .select('measurements, updated_at')
        .eq('user_id', user.id)
        .single();

    // 3. Fetch Essence Responses
    const { data: responses } = await supabase
        .from('essence_responses')
        .select('question_key, answer_value');

    // 4. Fetch Question Definitions (to find mappings)
    const { data: chapters } = await supabase
        .from('chapters')
        .select('lab_questions');

    // 5. Compile Essence
    const essence: StyleEssentials = {
        styleWords: [],
        archetype: [],
        powerFeatures: [],
        colorEnergy: []
    };

    // FALLBACK MAPPING
    const FALLBACK_MAP: Record<string, string> = {
        'style_words': 'style_words',
        'style_mood': 'style_words',
        'archetype': 'archetype',
        'power_features': 'power_features',
        'best_feature': 'power_features',
        'color_energy': 'color_energy',
        'power_color': 'color_energy'
    };

    // FALLBACK LABELS (if not found in DB chapters)
    const FALLBACK_LABELS: Record<string, string> = {
        'best_feature': 'Best Feature',
        'power_color': 'Power Color',
        'neutral_base': 'Neutral Base',
        'proportion_goal': 'Proportion Goal'
    };

    interface LabQuestion {
        key: string;
        label: string;
        mapToEssence?: boolean;
        mappingCategory?: string;
    }

    if (responses) {
        // Build maps
        const keyMap = new Map<string, string>();
        const labelMap = new Map<string, string>();

        if (chapters) {
            chapters.forEach(chap => {
                const questions = chap.lab_questions as unknown as LabQuestion[];
                if (Array.isArray(questions)) {
                    questions.forEach(q => {
                        // Map Category
                        if (q.mapToEssence && q.mappingCategory && q.key) {
                            keyMap.set(q.key, q.mappingCategory);
                        }
                        // Map Label (Always useful)
                        if (q.key && q.label) {
                            labelMap.set(q.key, q.label);
                        }
                    });
                }
            });
        }

        // Map responses to essence
        responses.forEach(r => {
            let category = keyMap.get(r.question_key);

            // Fallback Category
            if (!category && FALLBACK_MAP[r.question_key]) {
                category = FALLBACK_MAP[r.question_key];
            }

            if (category) {
                const val = r.answer_value;
                if (!val) return;

                // Determine Label
                const label = labelMap.get(r.question_key) || FALLBACK_LABELS[r.question_key] || "Essence";

                if (category === 'style_words') {
                    if (!essence.styleWords.includes(val)) essence.styleWords.push(val);
                }
                if (category === 'archetype') {
                    if (!essence.archetype.includes(val)) essence.archetype.push(val);
                }
                if (category === 'power_features') {
                    // Check duplicates by value
                    if (!essence.powerFeatures.some(i => i.value === val)) {
                        essence.powerFeatures.push({ label, value: val });
                    }
                }
                if (category === 'color_energy') {
                    if (!essence.colorEnergy.some(i => i.value === val)) {
                        essence.colorEnergy.push({ label, value: val });
                    }
                }
            }
        });
    }

    return {
        profile,
        tailorCard,
        essence
    };
}
