"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

async function checkAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { authorized: false, supabase };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    return {
        authorized: profile?.role === 'admin',
        supabase
    };
}

export async function createMasterclass(formData: FormData) {
    const { authorized, supabase } = await checkAdmin();
    if (!authorized) {
        return { success: false, error: "Unauthorized" };
    }

    const title = formData.get('title') as string;
    const subtitle = formData.get('subtitle') as string;
    const description = formData.get('description') as string;
    const titleEs = formData.get('titleEs') as string;
    const subtitleEs = formData.get('subtitleEs') as string;
    const descriptionEs = formData.get('descriptionEs') as string;
    const thumbnailUrl = formData.get('thumbnailUrl') as string;
    const orderIndex = parseInt(formData.get('orderIndex') as string) || 0;
    const stripeProductId = formData.get('stripeProductId') as string;
    const priceId = formData.get('priceId') as string;
    const videoUrl = formData.get('videoUrl') as string;

    const { data, error } = await supabase
        .from('masterclasses')
        .insert({
            title,
            subtitle,
            description,
            title_es: titleEs,
            subtitle_es: subtitleEs,
            description_es: descriptionEs,
            thumbnail_url: thumbnailUrl,
            video_url: videoUrl,
            order_index: orderIndex,
            stripe_product_id: stripeProductId,
            price_id: priceId
        })
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
    const { authorized, supabase } = await checkAdmin();
    if (!authorized) {
        return { success: false, error: "Unauthorized" };
    }

    const title = formData.get('title') as string;
    const subtitle = formData.get('subtitle') as string;
    const description = formData.get('description') as string;
    const titleEs = formData.get('titleEs') as string;
    const subtitleEs = formData.get('subtitleEs') as string;
    const descriptionEs = formData.get('descriptionEs') as string;
    const thumbnailUrl = formData.get('thumbnailUrl') as string;
    const orderIndex = parseInt(formData.get('orderIndex') as string) || 0;
    const stripeProductId = formData.get('stripeProductId') as string;
    const priceId = formData.get('priceId') as string;
    const videoUrl = formData.get('videoUrl') as string;

    const { error } = await supabase
        .from('masterclasses')
        .update({
            title,
            subtitle,
            description,
            title_es: titleEs,
            subtitle_es: subtitleEs,
            description_es: descriptionEs,
            thumbnail_url: thumbnailUrl,
            video_url: videoUrl,
            order_index: orderIndex,
            stripe_product_id: stripeProductId,
            price_id: priceId,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true };
}

export async function deleteMasterclass(id: string) {
    const { authorized, supabase } = await checkAdmin();
    if (!authorized) {
        return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase
        .from('masterclasses')
        .delete()
        .eq('id', id);

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
