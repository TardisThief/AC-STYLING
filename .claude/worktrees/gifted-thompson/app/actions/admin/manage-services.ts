'use server'

import { createClient } from "@/utils/supabase/server";
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

export async function upsertService(serviceData: any) {
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

    const { error } = await supabase
        .from('services')
        .upsert(serviceData)
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

    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

    if (error) {
        console.error("Error deleting service:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/services', 'page');
    return { success: true };
}
