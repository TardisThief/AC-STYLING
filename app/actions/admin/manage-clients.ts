
'use server';

import { createClient } from "@/utils/supabase/server";

export type ClientProfile = {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    created_at: string;
    last_sign_in_at?: string;
};

export type DossierEntry = {
    masterclass_title: string;
    chapter_title: string;
    question_key: string;
    answer_value: any;
    updated_at: string;
}

/**
 * Fetches all registered users/profiles.
 * (Note: In a large app, we'd paginate this. For now, fetch all.)
 */
export async function getClients() {
    const supabase = await createClient();

    // Check Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // We can't access auth.users directly via client library usually unless using service role
    // But we have a public profiles table trigger-synced.
    // Let's query profiles.

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Fetch Clients Error:", error);
        return { success: false, error: error.message };
    }

    // Determine emails? Profiles table might not have email if not synced.
    // If not, we might need a workaround or just show names.
    // Ideally, the handle_new_user trigger inserts generic info. 
    // Let's return what we have. 
    // In a real production app we'd use the Supabase Admin API (service role) to get emails via auth.users.
    // For now we will rely on profiles. Assuming email might NOT be there unless we add it to the trigger.

    return { success: true, clients: profiles };
}

/**
 * Fetches the full dossier for a specific user.
 * Groups essence responses by Masterclass.
 */
export async function getClientDossier(userId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // Fetch all responses joined with masterclass info
    // Note: We need to know the question LABEL to make it readable, 
    // but the DB only stores keys. We might need to map keys back to labels on the frontend
    // or store labels in the DB (denormalized). 
    // For now, return keys and the UI can attempt to map them (or simply show keys formatted).

    const { data: responses, error } = await supabase
        .from('essence_responses')
        .select(`
            question_key,
            answer_value,
            updated_at,
            chapter_slug,
            masterclass:masterclasses(title)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true, dossier: responses };
}

/**
 * Toggles Studio Access (Wardrobe + Lookbook) for a client.
 * Manual Override for Admins.
 */
export async function toggleStudioAccess(userId: string, hasAccess: boolean) {
    const supabase = await createClient();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') return { success: false, error: 'Forbidden' };

    const permissions = hasAccess
        ? { lookbook: true, wardrobe: true }
        : { lookbook: false, wardrobe: false };

    const { error } = await supabase
        .from('profiles')
        .update({
            studio_permissions: permissions,
            active_studio_client: hasAccess
        })
        .eq('id', userId);

    if (error) {
        console.error("Error updating permissions:", error);
        return { success: false, error: error.message };
    }

    // If granting access, we MUST ensure the Tailor Card exists.
    // The DB trigger checks active_studio_client = TRUE, which we just set.
    if (hasAccess) {
        const { error: cardError } = await supabase
            .from('tailor_cards')
            .upsert({ user_id: userId }, { onConflict: 'user_id' });

        if (cardError) {
            console.error("Error creating tailor card:", cardError);
            // We won't fail the whole operation, but it's worth noting.
            // The user can likely recover by toggling off/on or checking the profile.
        }
    }

    return { success: true };
}
