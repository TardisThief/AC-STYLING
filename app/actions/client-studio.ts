"use server";

import { requireUser } from "@/app/lib/auth-guards";
import { parseInput, uuid } from "@/app/lib/validation/parse";
import { clientItemUpdateSchema, measurementsSchema } from "@/app/lib/validation/client-studio";

/**
 * A Studio client's own edits, from ClientStudioDashboard.
 *
 * These used to be written straight from her browser. Members have no write
 * policy on tailor_cards and no UPDATE policy on wardrobe_items, so the
 * measurement save failed outright and every item edit updated nothing while
 * reporting success. Rather than open those tables to browser writes — where
 * column grants would also bind the stylist's own `authenticated` writes —
 * each edit is a guarded action: who she is, what she may change, and that the
 * row is hers, checked here; the write then goes through the service role.
 */

/** Save her own measurements. Only for a Studio client. */
export async function saveMyMeasurements(
    measurements: unknown
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireUser();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(measurementsSchema, measurements);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { data: profile } = await auth.supabase
        .from('profiles')
        .select('active_studio_client')
        .eq('id', auth.user.id)
        .single();
    if (!profile?.active_studio_client) {
        return { success: false, error: 'Studio access is required to save measurements.' };
    }

    const { createAdminClient } = await import('@/utils/supabase/admin');
    const { error } = await createAdminClient()
        .from('tailor_cards')
        .upsert(
            {
                user_id: auth.user.id,
                measurements: parsed.data,
                last_updated_by: auth.user.id,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
        );

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Change what she may change on one of her own items. */
export async function updateMyWardrobeItem(
    itemId: string,
    updates: unknown
): Promise<{ success: boolean; error?: string }> {
    const auth = await requireUser();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsedId = parseInput(uuid('Item id'), itemId);
    if (!parsedId.ok) return { success: false, error: parsedId.error };

    const parsed = parseInput(clientItemUpdateSchema, updates);
    if (!parsed.ok) return { success: false, error: parsed.error };
    if (Object.keys(parsed.data).length === 0) return { success: false, error: 'Nothing to update' };

    // Hers means: in a wardrobe she owns. Her own SELECT policy already
    // answers exactly that, so ask through her client rather than re-deriving
    // the rule with the service role.
    const { data: item } = await auth.supabase
        .from('wardrobe_items')
        .select('id, wardrobe_id')
        .eq('id', parsedId.data)
        .maybeSingle();
    if (!item?.wardrobe_id) return { success: false, error: 'Item not found' };

    const { data: wardrobe } = await auth.supabase
        .from('wardrobes')
        .select('id')
        .eq('id', item.wardrobe_id)
        .eq('owner_id', auth.user.id)
        .maybeSingle();
    if (!wardrobe) return { success: false, error: 'Item not found' };

    const { createAdminClient } = await import('@/utils/supabase/admin');
    const { data: written, error } = await createAdminClient()
        .from('wardrobe_items')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', parsedId.data)
        .eq('wardrobe_id', wardrobe.id)
        .select('id');

    if (error) return { success: false, error: error.message };
    // Never report a save that did not happen — that was the original bug.
    if (!written || written.length === 0) return { success: false, error: 'Item not found' };
    return { success: true };
}
