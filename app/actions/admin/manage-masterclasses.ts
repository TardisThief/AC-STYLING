"use server";

import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/app/lib/auth-guards';
import { parseInput, uuid } from '@/app/lib/validation/parse';
import { masterclassSchema } from '@/app/lib/validation/masterclasses';
import { revalidatePath } from 'next/cache';

// Map the admin form's FormData field names onto DB column names.
function masterclassInput(formData: FormData) {
    return {
        title: formData.get('title'),
        subtitle: formData.get('subtitle'),
        description: formData.get('description'),
        title_es: formData.get('titleEs'),
        subtitle_es: formData.get('subtitleEs'),
        description_es: formData.get('descriptionEs'),
        thumbnail_url: formData.get('thumbnailUrl'),
        video_url: formData.get('videoUrl'),
        order_index: formData.get('orderIndex'),
        stripe_product_id: formData.get('stripeProductId'),
        price_id: formData.get('priceId'),
    };
}

export async function createMasterclass(formData: FormData) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(masterclassSchema, masterclassInput(formData));
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { data, error } = await auth.supabase
        .from('masterclasses')
        .insert(parsed.data)
        .select()
        .single();
    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true, masterclass: data };
}

export async function updateMasterclass(id: string, formData: FormData) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Masterclass id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(masterclassSchema, masterclassInput(formData));
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('masterclasses')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', idParsed.data);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true };
}

export async function deleteMasterclass(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Masterclass id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase
        .from('masterclasses')
        .delete()
        .eq('id', idParsed.data);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true };
}

export async function getMasterclasses() {
    const supabase = await createClient(); // Public read is allowed via RLS

    const { data, error } = await supabase
        .from('masterclasses')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) {
        return { success: false, error: error.message, masterclasses: [] };
    }

    return { success: true, masterclasses: data };
}
