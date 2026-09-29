
'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { loadLabQuestionsFor } from "@/app/lib/paid-content";
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '@/lib/database.types';
import { requireUser } from "@/app/lib/auth-guards";
import { jsonArray } from "@/app/lib/json";
import { parseInput } from "@/app/lib/validation/parse";
import { completeChapterSchema, labUnlockSchema } from "@/app/lib/validation/progress";

export type EssenceResponse = {
    question_key: string;
    answer_value: Json;
    chapter_slug: string | null;
    updated_at: string | null;
};

type ChapterRow = { id: string; slug: string; lab_questions: Json | null };

/**
 * The chapter, if the caller is a signed-in (not anonymous) member entitled to
 * it. Entitlement is the `check_access` RPC, asked through her own session as
 * in getChapterVideo; the row itself comes through the service role, since
 * `lab_questions` is paid content (migration 30).
 */
async function entitledChapter(by: { id: string } | { slug: string }) {
    const auth = await requireUser();
    if (!auth.ok) return { ok: false as const, error: auth.error };
    if (auth.user.is_anonymous) return { ok: false as const, error: 'Unauthorized' };

    const { createAdminClient } = await import('@/utils/supabase/admin');
    const admin = createAdminClient();
    const query = admin.from('chapters').select('id, slug, lab_questions');
    const { data: chapter } = await ('id' in by ? query.eq('id', by.id) : query.eq('slug', by.slug)).maybeSingle<ChapterRow>();
    // The same answer for a chapter that does not exist and one she has not
    // bought: neither says which.
    if (!chapter) return { ok: false as const, error: 'Forbidden' };

    const { data: allowed, error } = await auth.supabase.rpc('check_access', {
        check_user_id: auth.user.id,
        check_object_id: chapter.id,
    });
    if (error || !allowed) return { ok: false as const, error: 'Forbidden' };

    return { ok: true as const, user: auth.user, supabase: auth.supabase, admin, chapter };
}

/** Record a progress event once. The unique (user_id, content_id) makes a repeat a no-op. */
async function recordProgress(admin: SupabaseClient, userId: string, contentId: string) {
    return admin
        .from('user_progress')
        .upsert(
            { user_id: userId, content_id: contentId, completed_at: new Date().toISOString() },
            { onConflict: 'user_id,content_id', ignoreDuplicates: true },
        );
}

function isAnswered(value: Json | null | undefined): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

/**
 * Marks that a user has unlocked the Essence Lab for a chapter (she finished
 * its video). The unlock is what lets her Essence journal read the chapter's
 * paid questions (getAllEssenceData), so it is only recorded for a chapter she
 * is entitled to, and written by the server (member INSERT on user_progress is
 * gone, migration 38).
 */
export async function markLabUnlocked(chapterSlug: string) {
    const parsed = parseInput(labUnlockSchema, { chapterSlug });
    if (!parsed.ok) return { success: false, error: parsed.error };

    const entitled = await entitledChapter({ slug: parsed.data.chapterSlug });
    if (!entitled.ok) return { success: false, error: entitled.error };

    const { error } = await recordProgress(entitled.admin, entitled.user.id, `lab_unlocked:${entitled.chapter.slug}`);
    if (error) {
        console.error("markLabUnlocked Error:", error);
        return { success: false, error: 'Could not save your progress' };
    }
    return { success: true };
}

/**
 * Master a chapter: she is entitled to it and has answered every one of its
 * Lab questions (a chapter without questions is mastered by finishing it).
 *
 * The progress id is `foundations/<slug>` for modules and standalone courses
 * alike: it is what every reader looks for (the chapter and course pages, the
 * course and masterclass lists, the dashboard). The browser used to write
 * `courses/<slug>` for courses, which nothing read.
 */
export async function completeChapter(input: { chapterId: string }): Promise<
    { success: true; mastered: boolean } | { success: false; error: string }
> {
    const parsed = parseInput(completeChapterSchema, input);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const entitled = await entitledChapter({ id: parsed.data.chapterId });
    if (!entitled.ok) return { success: false, error: entitled.error };
    const { user, supabase, admin, chapter } = entitled;

    const questionKeys = jsonArray(chapter.lab_questions)
        .map(q => (q && typeof q === 'object' && !Array.isArray(q) ? q.key : null))
        .filter((key): key is string => typeof key === 'string' && key !== '');

    if (questionKeys.length > 0) {
        const { data: responses, error } = await supabase
            .from('essence_responses')
            .select('question_key, answer_value')
            .eq('user_id', user.id)
            .eq('chapter_id', chapter.id);
        if (error) return { success: false, error: 'Could not check your answers' };

        const answered = new Set((responses ?? []).filter(r => isAnswered(r.answer_value)).map(r => r.question_key));
        if (!questionKeys.every(key => answered.has(key))) return { success: true, mastered: false };
    }

    const { error } = await recordProgress(admin, user.id, `foundations/${chapter.slug}`);
    if (error) {
        console.error("completeChapter Error:", error);
        return { success: false, error: 'Could not save your progress' };
    }
    return { success: true, mastered: true };
}

export async function saveEssenceResponse(
    masterclassId: string | null,
    chapterId: string,
    chapterSlug: string,
    questionKey: string,
    // answer_value is NOT NULL.
    answerValue: Exclude<Json, null>
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
            masterclasses ( id, title )
        `)
        .in('slug', unlockedChapterSlugs);

    if (!chaptersData) return [];

    const unlockedChapterIds = chaptersData.map((c: { id: string }) => c.id);

    // The questions are paid content (migration 30), so they come through the
    // service role — only for chapters whose Lab she has unlocked, which is
    // taken from her own progress rows above.
    const questionsByChapter = await loadLabQuestionsFor(unlockedChapterIds);

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

        const questions = questionsByChapter.get(chapter.id) ?? [];

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
