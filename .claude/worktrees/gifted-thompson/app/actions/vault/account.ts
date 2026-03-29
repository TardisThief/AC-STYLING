'use server';

import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin-client";
import { revalidatePath } from "next/cache";

export async function deleteAccount() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        const adminClient = createSupabaseAdminClient();

        // This should cascade to all user data if your DB is set up correctly (ON DELETE CASCADE)
        // If not, you might need to manually delete from public tables first.
        // Assuming cascade is set up for profiles, wardrobe_items, etc.
        const { error } = await adminClient.auth.admin.deleteUser(user.id);

        if (error) {
            console.error("Error deleting user:", error);
            return { success: false, error: error.message };
        }

        // Sign out the user locally (optional since they are deleted, but good practice)
        await supabase.auth.signOut();

        return { success: true };
    } catch (e) {
        console.error("Unexpected error deleting account:", e);
        return { success: false, error: "An unexpected error occurred." };
    }
}
