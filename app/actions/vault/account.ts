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

/** Wardrobe photographs live under `<userId>/…` in this private bucket. */
const WARDROBE_BUCKET = 'studio-wardrobe';

/**
 * Remove the caller's uploaded images.
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
    try {
        const { data: files, error: listError } = await adminClient
            .storage
            .from(WARDROBE_BUCKET)
            .list(userId, { limit: 1000 });

        if (listError) return { removed: 0, error: listError.message };
        if (!files?.length) return { removed: 0 };

        const paths = files.map((f) => `${userId}/${f.name}`);
        const { error: removeError } = await adminClient
            .storage
            .from(WARDROBE_BUCKET)
            .remove(paths);

        if (removeError) return { removed: 0, error: removeError.message };
        return { removed: paths.length };
    } catch (e) {
        return { removed: 0, error: e instanceof Error ? e.message : String(e) };
    }
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
