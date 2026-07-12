"use server";

import { parseInput } from '@/app/lib/validation/parse';
import { intakeUploadUrlSchema, intakeItemSchema } from '@/app/lib/validation/intake';
import { wardrobeUploadPath } from '@/lib/wardrobe-paths';

/**
 * Guest wardrobe intake, direct-to-storage. File bytes must not pass through
 * a server action (Vercel caps request bodies at 4.5 MB), so the browser
 * uploads via a signed URL and these actions only validate the intake token
 * (service role — guests have no session) and record the result.
 */

async function findInviteProfile(token: string) {
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('intake_token', token)
        .single();
    if (error || !data) return { supabase, profile: null };
    return { supabase, profile: data };
}

export async function createIntakeUploadUrl(token: string, fileName: string) {
    const parsed = parseInput(intakeUploadUrlSchema, { token, file_name: fileName });
    if (!parsed.ok) return { success: false as const, error: parsed.error };

    const { supabase, profile } = await findInviteProfile(parsed.data.token);
    if (!profile) return { success: false as const, error: 'Invalid or expired intake token.' };

    const path = wardrobeUploadPath(null, profile.id, parsed.data.file_name);
    const { data, error } = await supabase.storage
        .from('studio-wardrobe')
        .createSignedUploadUrl(path);

    if (error || !data) {
        return { success: false as const, error: error?.message || 'Could not authorize upload' };
    }
    return { success: true as const, path: data.path, token: data.token };
}

export async function createIntakeItem(token: string, filePath: string, note: string) {
    const parsed = parseInput(intakeItemSchema, { token, file_path: filePath, note });
    if (!parsed.ok) return { success: false as const, error: parsed.error };

    const { supabase, profile } = await findInviteProfile(parsed.data.token);
    if (!profile) return { success: false as const, error: 'Invalid or expired intake token.' };

    // Only accept paths in this profile's own intake folder.
    if (!parsed.data.file_path.startsWith(`wardrobe/${profile.id}/`)) {
        return { success: false as const, error: 'Invalid upload path' };
    }

    const { data: { publicUrl } } = supabase.storage
        .from('studio-wardrobe')
        .getPublicUrl(parsed.data.file_path);

    const { error } = await supabase.from('wardrobe_items').insert({
        user_id: profile.id,
        image_url: publicUrl,
        client_note: parsed.data.note,
        status: 'inbox',
    });

    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
}
