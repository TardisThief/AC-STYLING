
'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type EssenceResponse = {
    question_key: string;
    answer_value: unknown;
    chapter_slug?: string;
    updated_at: string;
};

/**
 * Marks that a user has unlocked the Essence Lab for a specific chapter
 * by recording a specific user_progress event.
 */
export async function markLabUnlocked(chapterSlug: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !chapterSlug) return { success: false };

    const contentId = `lab_unlocked:${chapterSlug}`;

    // Check existence
    const { data: existing } = await supabase
        .from('user_progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', contentId)
        .maybeSingle();

    if (!existing) {
        const { error } = await supabase
            .from('user_progress')
            .insert({
                user_id: user.id,
                content_id: contentId,
                completed_at: new Date().toISOString()
            });

        if (error) {
            console.error("markLabUnlocked Error:", error);
            return { success: false, error: error.message };
        }
    }

    return { success: true };
}
export async function saveEssenceResponse(
    masterclassId: string | null,
    chapterId: string,
    chapterSlug: string,
    questionKey: string,
    answerValue: unknown
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

    // Check existence
    const { data: existing } = await supabase
        .from('essence_responses')
        .select('id')
        .eq('user_id', user.id)
        .eq('chapter_id', chapterId)
        .eq('question_key', questionKey)
        .maybeSingle();

    let error;
    if (existing) {
        const { error: updateError } = await supabase
            .from('essence_responses')
            .update({
                answer_value: answerValue,
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        error = updateError;
    } else {
        const { error: insertError } = await supabase
            .from('essence_responses')
            .insert({
                user_id: user.id,
                masterclass_id: targetMasterclassId,
                chapter_id: chapterId,
                chapter_slug: chapterSlug,
                question_key: questionKey,
                answer_value: answerValue,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            });
        error = insertError;
    }

    if (error) {
        console.error("Save Essence Error:", error);
        return { success: false, error: error.message };
    }

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
 * Integrates lab_unlocked trackers with lab_questions definition array.
 */
export async function getAllEssenceData() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // 1. Get unlocked chapters
    const { data: progressData } = await supabase
        .from('user_progress')
        .select('content_id')
        .eq('user_id', user.id)
        .like('content_id', 'lab_unlocked:%');

    if (!progressData || progressData.length === 0) return [];

    // Parse chapter slugs out of the content_ids
    const unlockedChapterSlugs = progressData.map(p => p.content_id.split(':')[1]).filter(id => id && id.length > 0);

    if (unlockedChapterSlugs.length === 0) return [];

    // 2. Fetch those chapters with their masterclass
    const { data: chaptersData } = await supabase
        .from('chapters')
        .select(`
            id,
            slug,
            title,
            masterclass_id,
            lab_questions,
            masterclasses ( id, title )
        `)
        .in('slug', unlockedChapterSlugs);

    if (!chaptersData) return [];

    const unlockedChapterIds = chaptersData.map((c: { id: string }) => c.id);

    // 3. Fetch essence_responses for this user
    const { data: responsesData } = await supabase
        .from('essence_responses')
        .select('*')
        .eq('user_id', user.id)
        .in('chapter_id', unlockedChapterIds);

    // Shapes mirror components/vault/EssenceJournal.tsx (structural match).
    type EssenceQuestion = { key: string; label: string; placeholder: string; value: string; updated_at: string | null };
    type EssenceChapter = { chapterId: string; chapterTitle: string; chapterSlug: string; questions: EssenceQuestion[] };
    type EssenceMasterclassGroup = { masterclassId: string; masterclassTitle: string; chapters: EssenceChapter[] };

    const masterclassGroups: Record<string, EssenceMasterclassGroup> = {};

    for (const chapter of chaptersData) {
        const mcId = chapter.masterclass_id || 'standalone';
        // Handle postgres single vs array reference returned by supabase type
        const masterclassObj = Array.isArray(chapter.masterclasses) ? chapter.masterclasses[0] : chapter.masterclasses;
        const mcTitle = masterclassObj?.title || 'Standalone Courses';

        if (!masterclassGroups[mcId]) {
            masterclassGroups[mcId] = {
                masterclassId: mcId,
                masterclassTitle: mcTitle,
                chapters: []
            };
        }

        const questions = Array.isArray(chapter.lab_questions) ? chapter.lab_questions : [];

        if (questions.length === 0) continue;

        const chapterQuestions: EssenceQuestion[] = questions.map((q: Record<string, unknown>) => {
            const resp = responsesData?.find(r => r.chapter_id === chapter.id && r.question_key === q.key);
            let val: unknown = resp?.answer_value || '';
            if (typeof val === 'object' && val !== null) {
                val = JSON.stringify(val);
            }

            return {
                key: String(q.key ?? ''),
                label: String(q.label ?? q.key ?? ''),
                placeholder: String(q.placeholder ?? ''),
                value: typeof val === 'string' ? val : String(val ?? ''),
                updated_at: resp?.updated_at || null
            };
        });

        // Ensure we sort chapters predictably? Order is arbitrary right now but ok
        masterclassGroups[mcId].chapters.push({
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            chapterSlug: chapter.slug,
            questions: chapterQuestions
        });
    }

    return Object.values(masterclassGroups);
}

/**
 * Checks if the user has any missing answers across all unlocked chapters within
 * the masterclass of the given chapterId.
 */
export async function checkIncompleteMasterclassLabs(chapterId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data: chData } = await supabase.from('chapters').select('masterclass_id').eq('id', chapterId).single();
    if (!chData?.masterclass_id) return false;

    const allData = await getAllEssenceData();
    if (!allData) return false;

    const mcBlock = allData.find(a => a.masterclassId === chData.masterclass_id);
    if (!mcBlock) return false;

    for (const ch of mcBlock.chapters) {
        for (const q of ch.questions) {
            if ((q.value || '').trim().length === 0) {
                return true;
            }
        }
    }
    return false;
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
