'use server';

import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin-client";

/**
 * Close an account and remove the data that belongs to it.
 *
 * What this used to be: a single `auth.admin.deleteUser` call, above a comment
 * reading "This should cascade to all user data if your DB is set up
 * correctly". It was not. Measured on the live database before migration 15:
 *
 *   - `user_progress.user_id` and `tailor_cards.last_updated_by` referenced
 *     `auth.users` with NO ACTION, so the delete **failed outright** for
 *     anyone who had watched anything;
 *   - `public.profiles` had no foreign key to `auth.users` at all, so even a
 *     successful delete left the profile — and everything cascading from it —
 *     in place.
 *
 * Migration 15 fixes the constraints. This handles the parts a constraint
 * cannot: storage objects, and telling the truth about what happened.
 */

/**
 * Buckets where her own files live under `<userId>/…`: wardrobe photographs
 * and lookbook thumbnails, and her avatar (the avatars upload policy scopes to
 * the same folder). Intake uploads under `wardrobe/<id>/…` belong to the
 * wardrobe, whose fate after she leaves is an open owner decision
 * (docs/OWNER-ACTIONS.md, item 7), so they are not touched here.
 */
const USER_FOLDER_BUCKETS = ['studio-wardrobe', 'avatars'] as const;

/** Page size for listing, and the cap on pages per folder. */
const LIST_PAGE = 1000;
const MAX_PAGES = 100;

/**
 * Every object path under `folder`, sub-folders included.
 *
 * Storage lists one level at a time, folders as entries with a null id, and
 * pages with limit/offset. This used to read one level and one page, so a
 * file in a sub-folder or past the 1,000th outlived the account (DATA-001,
 * tests/unit/account-deletion-storage.test.ts).
 */
async function listRecursively(
    bucket: ReturnType<ReturnType<typeof createSupabaseAdminClient>['storage']['from']>,
    folder: string
): Promise<string[]> {
    const paths: string[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const { data, error } = await bucket.list(folder, { limit: LIST_PAGE, offset: page * LIST_PAGE });
        if (error) throw new Error(error.message);
        for (const entry of data ?? []) {
            const path = `${folder}/${entry.name}`;
            if (entry.id === null) paths.push(...(await listRecursively(bucket, path)));
            else paths.push(path);
        }
        if (!data || data.length < LIST_PAGE) break;
    }
    return paths;
}

/**
 * Remove the caller's files from every bucket that keeps them under her id.
 *
 * Storage objects are not rows and no cascade reaches them, so without this
 * they outlive the account indefinitely. Reported rather than thrown: an
 * account closure that stops halfway because an image would not delete is
 * worse than one that finishes and tells us what it could not reach.
 */
async function deleteStorageObjects(
    adminClient: ReturnType<typeof createSupabaseAdminClient>,
    userId: string
): Promise<{ removed: number; error?: string }> {
    let removed = 0;
    const errors: string[] = [];
    for (const name of USER_FOLDER_BUCKETS) {
        try {
            const bucket = adminClient.storage.from(name);
            const paths = await listRecursively(bucket, userId);
            // remove() takes a batch; keep batches to one listing page.
            for (let i = 0; i < paths.length; i += LIST_PAGE) {
                const batch = paths.slice(i, i + LIST_PAGE);
                const { error } = await bucket.remove(batch);
                if (error) throw new Error(error.message);
                removed += batch.length;
            }
        } catch (e) {
            errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return errors.length ? { removed, error: errors.join('; ') } : { removed };
}

export async function deleteAccount() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        const adminClient = createSupabaseAdminClient();

        // Storage first: once the auth user is gone we no longer have a
        // reliable handle on which objects were theirs.
        const storage = await deleteStorageObjects(adminClient, user.id);
        if (storage.error) {
            // Not fatal. The account still closes; this is recorded so the
            // leftover objects can be swept rather than silently kept.
            console.error(
                `[deleteAccount] storage cleanup incomplete for ${user.id}: ${storage.error}`
            );
        }

        // Since migration 15 this cascades through `profiles` to wardrobe
        // items, lookbooks, questions, grants and tailor cards, and through
        // the direct references to progress and essence responses.
        const { error } = await adminClient.auth.admin.deleteUser(user.id);

        if (error) {
            console.error("Error deleting user:", error);
            return { success: false, error: error.message };
        }

        await supabase.auth.signOut();

        return {
            success: true,
            // Surfaced so the caller can say something honest rather than an
            // unconditional "everything has been deleted".
            storageCleanupFailed: !!storage.error,
        };
    } catch (e) {
        console.error("Unexpected error deleting account:", e);
        return { success: false, error: "An unexpected error occurred." };
    }
}
