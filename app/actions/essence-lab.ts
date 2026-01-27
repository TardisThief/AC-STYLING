
'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type EssenceResponse = {
    question_key: string;
    answer_value: any;
    chapter_slug?: string;
    updated_at: string;
};

/**
 * Saves (Upserts) a user's answer to the essence_responses table.
 */
export async function saveEssenceResponse(
    masterclassId: string | null,
    chapterId: string,
    chapterSlug: string,
    questionKey: string,
    answerValue: any
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: 'Unauthorized' };
    }

    // Clean masterclassId - if it's "standalone" or invalid UUID, set to null
    let targetMasterclassId = masterclassId;
    if (masterclassId === 'standalone' || !masterclassId) {
        targetMasterclassId = null;
    }

    // Upsert logic
    const { error } = await supabase
        .from('essence_responses')
        .upsert({
            user_id: user.id,
            masterclass_id: targetMasterclassId,
            chapter_id: chapterId,
            chapter_slug: chapterSlug,
            question_key: questionKey,
            answer_value: answerValue,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id, question_key, masterclass_id, chapter_id'
        });

    if (error) {
        console.error("Save Essence Error:", error);
        return { success: false, error: error.message };
    }

    // Optional: Revalidate if we want immediate server-side reflection, 
    // but client optimistic updates usually handle this better for inputs.
    // revalidatePath(`/vault/foundations/${chapterSlug}`);

    return { success: true };
}

/**
 * Fetches all essence responses for a user in a specific masterclass.
 * Returns a map of question_key -> response object.
 */
export async function getEssenceProgress(masterclassId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return {};
    }

    const { data, error } = await supabase
        .from('essence_responses')
        .select('question_key, answer_value, chapter_slug, updated_at')
        .eq('user_id', user.id)
        .eq('masterclass_id', masterclassId);

    if (error) {
        console.error("Fetch Essence Error:", error);
        return {};
    }

    // Transform into a Map-like object for easy O(1) lookup
    const responseMap: Record<string, EssenceResponse> = {};
    data?.forEach(row => {
        responseMap[row.question_key] = {
            question_key: row.question_key,
            answer_value: row.answer_value,
            chapter_slug: row.chapter_slug,
            updated_at: row.updated_at
        };
    });

    return responseMap;
}

/**
 * Fetches ALL essence responses for the user, grouped by Masterclass -> Chapter.
 * Used for the "My Styling Essence" journal page.
 */
export async function getAllEssenceData() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Fetch responses with related masterclass and chapter data
    // Note: We need to handle the case where chapter_slug might not directly link to a chapter ID easily 
    // without a join, but we stored chapter_slug text. 
    // Ideally we join on masterclass_id to get the Masterclass Title.

    const { data, error } = await supabase
        .from('essence_responses')
        .select(`
            question_key,
            answer_value,
            chapter_slug,
            updated_at,
            masterclass:masterclasses (
                id,
                title
            ),
            chapter:chapters (
                id,
                title
            )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Fetch All Essence Error:", error);
        return null;
    }

    // Grouping Logic
    const grouped: Record<string, { title: string, entries: any[] }> = {};

    data?.forEach((row: any) => {
        const mcTitle = row.masterclass?.title || row.chapter?.title || "General Styling";
        const mcId = row.masterclass?.id || row.chapter?.id || "general";

        if (!grouped[mcId]) {
            grouped[mcId] = { title: mcTitle, entries: [] };
        }

        grouped[mcId].entries.push({
            question_key: row.question_key,
            answer_value: row.answer_value,
            chapter_slug: row.chapter_slug,
            updated_at: row.updated_at
        });
    });

    return Object.values(grouped);
}

export async function getFlatEssenceAnswers() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
        .from('essence_responses')
        .select('question_key, answer_value')
        .eq('user_id', user.id);

    if (error) {
        console.error("Fetch Flat Essence Error:", error);
        return [];
    }

    return data || [];
}
