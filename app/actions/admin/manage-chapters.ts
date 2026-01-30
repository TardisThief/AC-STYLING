"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

async function checkAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { authorized: false, supabase, userId: null };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    return {
        authorized: profile?.role === 'admin',
        supabase,
        userId: user.id
    };
}

export async function createChapter(formData: FormData) {
    const { authorized, supabase } = await checkAdmin();
    if (!authorized) {
        return { success: false, error: "Unauthorized" };
    }

    const slug = formData.get('slug') as string;
    const title = formData.get('title') as string;
    const subtitle = formData.get('subtitle') as string;
    const description = formData.get('description') as string;
    const titleEs = formData.get('titleEs') as string;
    const subtitleEs = formData.get('subtitleEs') as string;
    const descriptionEs = formData.get('descriptionEs') as string;
    const videoId = formData.get('videoId') as string;
    const videoIdEs = formData.get('videoIdEs') as string || null;
    const thumbnailUrl = formData.get('thumbnailUrl') as string;
    const category = formData.get('category') as string || 'masterclass';
    const orderIndex = parseInt(formData.get('orderIndex') as string) || 0;
    const masterclassId = formData.get('masterclassId') as string || null;
    // If masterclassId is present, it's NOT standalone. If absent, check explicit toggle or default to true.
    const isStandalone = masterclassId ? false : (formData.get('isStandalone') === 'true');
    const stripeProductId = formData.get('stripeProductId') as string;
    const priceId = formData.get('priceId') as string;

    // Parse JSON fields
    const labQuestions = JSON.parse(formData.get('labQuestions') as string || '[]');
    const takeaways = JSON.parse(formData.get('takeaways') as string || '[]');
    const takeawaysEs = JSON.parse(formData.get('takeawaysEs') as string || '[]');
    const resourceUrls = JSON.parse(formData.get('resourceUrls') as string || '[]');

    // Insert chapter with all data
    const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .insert({
            slug,
            title,
            subtitle,
            description,
            title_es: titleEs,
            subtitle_es: subtitleEs,
            description_es: descriptionEs,
            video_id: videoId,
            video_id_es: videoIdEs,
            thumbnail_url: thumbnailUrl,
            category,
            order_index: orderIndex,
            masterclass_id: masterclassId,
            is_standalone: isStandalone,
            lab_questions: labQuestions,
            takeaways: takeaways,
            takeaways_es: takeawaysEs,
            resource_urls: resourceUrls,
            stripe_product_id: stripeProductId,
            price_id: priceId
        })
        .select()
        .single();
    if (chapterError) {
        console.error("Chapter creation error:", chapterError);
        return { success: false, error: chapterError.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');
    revalidatePath(`/vault/foundations/${slug}`);
    revalidatePath(`/${formData.get('locale') || 'en'}/vault/foundations/${slug}`);

    return { success: true, chapter };
}
export async function updateChapter(chapterId: string, formData: FormData) {
    const { authorized, supabase } = await checkAdmin();
    if (!authorized) {
        return { success: false, error: "Unauthorized" };
    }

    const slug = formData.get('slug') as string;
    const title = formData.get('title') as string;
    const subtitle = formData.get('subtitle') as string;
    const description = formData.get('description') as string;
    const titleEs = formData.get('titleEs') as string;
    const subtitleEs = formData.get('subtitleEs') as string;
    const descriptionEs = formData.get('descriptionEs') as string;
    const videoId = formData.get('videoId') as string;
    const videoIdEs = formData.get('videoIdEs') as string || null;
    const thumbnailUrl = formData.get('thumbnailUrl') as string;
    const category = formData.get('category') as string || 'masterclass';
    const orderIndex = parseInt(formData.get('orderIndex') as string) || 0;
    const masterclassId = formData.get('masterclassId') as string || null;
    const isStandalone = masterclassId ? false : (formData.get('isStandalone') === 'true');
    const stripeProductId = formData.get('stripeProductId') as string;
    const priceId = formData.get('priceId') as string;

    const labQuestions = JSON.parse(formData.get('labQuestions') as string || '[]');
    const takeaways = JSON.parse(formData.get('takeaways') as string || '[]');
    const takeawaysEs = JSON.parse(formData.get('takeawaysEs') as string || '[]');
    const resourceUrls = JSON.parse(formData.get('resourceUrls') as string || '[]');

    // Update chapter with all data
    const { error: chapterError } = await supabase
        .from('chapters')
        .update({
            slug,
            title,
            subtitle,
            description,
            title_es: titleEs,
            subtitle_es: subtitleEs,
            description_es: descriptionEs,
            video_id: videoId,
            video_id_es: videoIdEs,
            thumbnail_url: thumbnailUrl,
            category,
            order_index: orderIndex,
            masterclass_id: masterclassId,
            is_standalone: isStandalone,
            lab_questions: labQuestions,
            takeaways: takeaways,
            takeaways_es: takeawaysEs,
            resource_urls: resourceUrls,
            stripe_product_id: stripeProductId,
            price_id: priceId,
            updated_at: new Date().toISOString()
        })
        .eq('id', chapterId);

    if (chapterError) {
        return { success: false, error: chapterError.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');
    revalidatePath(`/vault/foundations/${slug}`);
    revalidatePath(`/${formData.get('locale') || 'en'}/vault/foundations/${slug}`);

    return { success: true };
}

export async function deleteChapter(chapterId: string) {
    const { authorized, supabase } = await checkAdmin();
    if (!authorized) {
        return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase
        .from('chapters')
        .delete()
        .eq('id', chapterId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true };
}

export async function getChapters() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) {
        console.error("Error fetching chapters:", error);
        return { success: false, error: error.message, chapters: [] };
    }

    return { success: true, chapters: data || [] };
}
