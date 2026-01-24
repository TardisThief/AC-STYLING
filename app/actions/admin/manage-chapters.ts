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
    const videoId = formData.get('videoId') as string;
    const thumbnailUrl = formData.get('thumbnailUrl') as string;
    const category = formData.get('category') as string || 'masterclass';
    const orderIndex = parseInt(formData.get('orderIndex') as string) || 0;

    // Parse JSON fields
    const labQuestions = JSON.parse(formData.get('labQuestions') as string || '[]');
    const takeaways = JSON.parse(formData.get('takeaways') as string || '[]');
    const resourceUrls = JSON.parse(formData.get('resourceUrls') as string || '[]');

    // Insert chapter
    const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .insert({
            slug,
            title,
            subtitle,
            description,
            video_id: videoId,
            thumbnail_url: thumbnailUrl,
            category,
            order_index: orderIndex
        })
        .select()
        .single();

    if (chapterError) {
        console.error("Chapter creation error:", chapterError);
        return { success: false, error: chapterError.message };
    }

    // Insert metadata
    const { error: metadataError } = await supabase
        .from('lesson_metadata')
        .insert({
            chapter_id: chapter.id,
            lab_questions: labQuestions,
            takeaways: takeaways,
            resource_urls: resourceUrls
        });

    if (metadataError) {
        console.error("Metadata creation error:", metadataError);
        return { success: false, error: metadataError.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');
    revalidatePath(`/vault/foundations/${slug}`);
    revalidatePath(`/${formData.get('locale')}/vault/foundations/${slug}`);

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
    const videoId = formData.get('videoId') as string;
    const thumbnailUrl = formData.get('thumbnailUrl') as string;
    const category = formData.get('category') as string || 'masterclass';
    const orderIndex = parseInt(formData.get('orderIndex') as string) || 0;

    const labQuestions = JSON.parse(formData.get('labQuestions') as string || '[]');
    const takeaways = JSON.parse(formData.get('takeaways') as string || '[]');
    const resourceUrls = JSON.parse(formData.get('resourceUrls') as string || '[]');

    // Update chapter
    const { error: chapterError } = await supabase
        .from('chapters')
        .update({
            slug,
            title,
            subtitle,
            description,
            video_id: videoId,
            thumbnail_url: thumbnailUrl,
            category,
            order_index: orderIndex,
            updated_at: new Date().toISOString()
        })
        .eq('id', chapterId);

    if (chapterError) {
        return { success: false, error: chapterError.message };
    }

    // Update metadata using upsert to handle cases where it might not exist
    const { error: metadataError } = await supabase
        .from('lesson_metadata')
        .upsert({
            chapter_id: chapterId,
            lab_questions: labQuestions,
            takeaways: takeaways,
            resource_urls: resourceUrls,
            updated_at: new Date().toISOString()
        }, { onConflict: 'chapter_id' });

    if (metadataError) {
        console.error("Metadata update error:", metadataError);
        return { success: false, error: metadataError.message };
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
        .select(`
            *,
            lesson_metadata (*)
        `)
        .order('order_index', { ascending: true });

    if (error) {
        console.error("Error fetching chapters:", error);
        return { success: false, error: error.message, chapters: [] };
    }

    return { success: true, chapters: data || [] };
}
