'use server';

import { createClient } from "@/utils/supabase/server";

export async function toggleBoutiqueSave(itemId: string): Promise<{ saved: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { saved: false, error: 'Unauthorized' };

    // Check if already saved
    const { data: existing } = await supabase
        .from('boutique_saves')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .maybeSingle();

    if (existing) {
        await supabase.from('boutique_saves').delete().eq('id', existing.id);
        return { saved: false };
    } else {
        await supabase.from('boutique_saves').insert({ user_id: user.id, item_id: itemId });
        return { saved: true };
    }
}

export async function getUserSavedItemIds(): Promise<string[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from('boutique_saves')
        .select('item_id')
        .eq('user_id', user.id);

    return (data || []).map(r => r.item_id);
}
