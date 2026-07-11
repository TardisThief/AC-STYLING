'use server'

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/app/lib/auth-guards";
import { parseInput, uuid } from "@/app/lib/validation/parse";
import { serviceSchema } from "@/app/lib/validation/services";
import { revalidatePath } from "next/cache";

export async function getServices(locale: string = 'en') {
    const supabase = await createClient();

    // Check if user is admin if requesting inactive/all?
    // For now, fetch all active for public, all for admin.
    // Simplifying: fetch all, client can filter. Or separate actions.

    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) {
        console.error("Error fetching services:", error);
        return { success: false, error: 'Failed to fetch services' };
    }

    return { success: true, services };
}

export async function upsertService(serviceData: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(serviceSchema, serviceData);
    if (!parsed.ok) return { success: false, error: parsed.error };

    // Row comes from the schema output only — unknown keys never reach the DB.
    const { error } = await auth.supabase
        .from('services')
        .upsert(parsed.data)
        .select()
        .single();

    if (error) {
        console.error("Error upserting service:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/services', 'page');
    return { success: true };
}

export async function deleteService(serviceId: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Service id'), serviceId);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase
        .from('services')
        .delete()
        .eq('id', idParsed.data);

    if (error) {
        console.error("Error deleting service:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/services', 'page');
    return { success: true };
}
