'use server'

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/app/lib/auth-guards";
import { parseInput } from "@/app/lib/validation/parse";
import { offerSchema } from "@/app/lib/validation/offers";
import { revalidatePath } from "next/cache";

export async function getOffer(slug: string) {
    const supabase = await createClient();
    const { data: offer, error } = await supabase
        .from('offers')
        .select('*')
        .eq('slug', slug)
        .single();

    // It's okay if not found initially
    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching offer:", error);
        return { success: false, error: 'Failed to fetch offer' };
    }

    return { success: true, offer };
}

export async function upsertOffer(offerData: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(offerSchema, offerData);
    if (!parsed.ok) return { success: false, error: parsed.error };

    // Row comes from the schema output only — unknown keys never reach the DB.
    const { error } = await auth.supabase
        .from('offers')
        .upsert(parsed.data)
        .select()
        .single();

    if (error) {
        console.error("Error saving offer:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/foundations', 'page'); // Revalidate potential consumer
    return { success: true };
}
