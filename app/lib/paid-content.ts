import { createAdminClient } from '@/utils/supabase/admin';
import type { StoredVaultResource, VaultResource } from '@/app/lib/types';

/**
 * Paid course material — Essence Lab questions and downloads — read on the
 * server, after the access check, through the service role.
 *
 * Browser roles cannot select these columns since migration 30 (MEDIA-001,
 * owner decision 2026-09-26: paid-only). Before it, anyone could read every
 * Lab question and download link from PostgREST, for unpurchased and
 * unpublished content alike; the pages only hid them.
 *
 * Every caller decides `hasAccess` with checkAccess() first. Without access
 * the caller gets the question COUNT (the page says "5 questions") and no
 * questions or links.
 *
 * Server-only: this imports the service-role client.
 */

/** Private bucket for paid downloads (migration 30). */
export const RESOURCE_BUCKET = 'vault-resources';
/** How long a download link works once the page has rendered. */
export const RESOURCE_LINK_SECONDS = 60 * 60;

/**
 * One Essence Lab question as the chapter rows store it. The Lab renders
 * `label` and `placeholder` (with `_es` variants) keyed by `key`; mapping
 * fields such as `mapToEssence` ride along.
 */
export type LabQuestion = {
    key: string;
    label: string;
    placeholder: string;
    label_es?: string;
    placeholder_es?: string;
    [field: string]: unknown;
};

export interface ChapterPaidContent {
    labQuestions: LabQuestion[];
    labQuestionCount: number;
    resources: VaultResource[];
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

/**
 * Turn stored resources into links she can open: a `path` in the private
 * bucket becomes a signed URL, an external `url` passes through. An item that
 * is neither, or whose file cannot be signed, is left out rather than shown
 * as a dead link.
 */
export async function resolveResources(stored: unknown): Promise<VaultResource[]> {
    const items = asArray(stored).filter(
        (r): r is StoredVaultResource => !!r && typeof r === 'object' && typeof (r as StoredVaultResource).name === 'string'
    );
    if (items.length === 0) return [];

    const admin = createAdminClient();
    const resolved = await Promise.all(items.map(async (item): Promise<VaultResource | null> => {
        if (item.path) {
            const { data, error } = await admin.storage
                .from(RESOURCE_BUCKET)
                .createSignedUrl(item.path, RESOURCE_LINK_SECONDS, { download: item.name });
            if (error || !data?.signedUrl) {
                console.error('[paid-content] could not sign', item.path, error?.message);
                return null;
            }
            return { name: item.name, url: data.signedUrl };
        }
        if (item.url && /^https?:\/\//.test(item.url)) return { name: item.name, url: item.url };
        return null;
    }));
    return resolved.filter((r): r is VaultResource => r !== null);
}

/**
 * A chapter's Lab questions and downloads — its masterclass's downloads first,
 * then its own — or, without access, only how many questions there are.
 */
export async function loadChapterPaidContent(
    chapterId: string,
    { hasAccess }: { hasAccess: boolean }
): Promise<ChapterPaidContent> {
    const admin = createAdminClient();
    const { data: chapter, error } = await admin
        .from('chapters')
        .select('lab_questions, resource_urls, masterclass_id')
        .eq('id', chapterId)
        .maybeSingle();

    if (error || !chapter) {
        if (error) console.error('[paid-content] chapter read failed:', error.message);
        return { labQuestions: [], labQuestionCount: 0, resources: [] };
    }

    const questions = asArray(chapter.lab_questions) as LabQuestion[];
    if (!hasAccess) return { labQuestions: [], labQuestionCount: questions.length, resources: [] };

    let masterclassResources: unknown[] = [];
    if (chapter.masterclass_id) {
        const { data: mc } = await admin
            .from('masterclasses')
            .select('resource_urls')
            .eq('id', chapter.masterclass_id)
            .maybeSingle();
        masterclassResources = asArray(mc?.resource_urls);
    }

    return {
        labQuestions: questions,
        labQuestionCount: questions.length,
        resources: await resolveResources([...masterclassResources, ...asArray(chapter.resource_urls)]),
    };
}

/** A masterclass's own downloads, or none without access. */
export async function loadMasterclassResources(
    masterclassId: string,
    { hasAccess }: { hasAccess: boolean }
): Promise<VaultResource[]> {
    if (!hasAccess) return [];
    const { data, error } = await createAdminClient()
        .from('masterclasses')
        .select('resource_urls')
        .eq('id', masterclassId)
        .maybeSingle();
    if (error) console.error('[paid-content] masterclass read failed:', error.message);
    return resolveResources(data?.resource_urls);
}

/**
 * Question definitions for chapters she has already answered or unlocked,
 * keyed by chapter id — for her own Essence journal and profile, which label
 * her answers. The caller must pass only chapters taken from her own rows.
 */
export async function loadLabQuestionsFor(chapterIds: string[]): Promise<Map<string, LabQuestion[]>> {
    const ids = [...new Set(chapterIds.filter(Boolean))];
    const byChapter = new Map<string, LabQuestion[]>();
    if (ids.length === 0) return byChapter;

    const { data, error } = await createAdminClient()
        .from('chapters')
        .select('id, lab_questions')
        .in('id', ids);
    if (error) {
        console.error('[paid-content] question read failed:', error.message);
        return byChapter;
    }
    for (const row of data ?? []) byChapter.set(row.id as string, asArray(row.lab_questions) as LabQuestion[]);
    return byChapter;
}
