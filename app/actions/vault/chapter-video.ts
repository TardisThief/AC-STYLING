"use server";

import { createAdminClient } from '@/utils/supabase/admin';

/**
 * Resolve a chapter's Vimeo id for a viewer who is entitled to it.
 *
 * After migration 09 the video columns are unreadable by `anon` and
 * `authenticated`, so playback cannot come from the page's own row fetch any
 * more. This is the only path to them.
 *
 * Entitlement is decided by the existing `check_access` RPC, which already
 * encodes every rule: admin, full unlock, course pass on standalone courses,
 * direct grants, and inheritance from a purchased masterclass. Re-implementing
 * that here would be a second source of truth for who has paid.
 *
 * Returns null for anyone unentitled — never throws, and never leaks whether
 * the chapter exists.
 */
export async function getChapterVideo(
    chapterId: string
): Promise<{ videoId: string | null; videoIdEs: string | null }> {
    const empty = { videoId: null, videoIdEs: null };

    if (!chapterId) return empty;

    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) return empty;

    // Ask the database, through the caller's own session, whether this user
    // may have this object. check_access is SECURITY DEFINER, so it can read
    // the grant tables without granting the caller access to them.
    const { data: allowed, error } = await supabase.rpc('check_access', {
        check_user_id: user.id,
        check_object_id: chapterId,
    });

    if (error || !allowed) return empty;

    // Only now, and only for the one row, with the service role.
    const admin = createAdminClient();
    const { data } = await admin
        .from('chapters')
        .select('video_id, video_id_es')
        .eq('id', chapterId)
        .maybeSingle();

    if (!data) return empty;

    return {
        videoId: (data.video_id as string) ?? null,
        videoIdEs: (data.video_id_es as string) ?? null,
    };
}
