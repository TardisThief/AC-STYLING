"use server";

import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/app/lib/auth-guards';
import { parseInput, uuid } from '@/app/lib/validation/parse';
import { chapterSchema } from '@/app/lib/validation/chapters';
import { revalidatePath } from 'next/cache';

// Map the admin form's FormData field names onto DB column names; validation
// and coercion happen in chapterSchema. (Module-private sync helpers are fine
// in a "use server" file — only exports must be async.)
function chapterInput(formData: FormData) {
    return {
        slug: formData.get('slug'),
        title: formData.get('title'),
        subtitle: formData.get('subtitle'),
        description: formData.get('description'),
        title_es: formData.get('titleEs'),
        subtitle_es: formData.get('subtitleEs'),
        description_es: formData.get('descriptionEs'),
        video_id: formData.get('videoId'),
        video_id_es: formData.get('videoIdEs'),
        thumbnail_url: formData.get('thumbnailUrl'),
        category: formData.get('category'),
        order_index: formData.get('orderIndex'),
        masterclass_id: formData.get('masterclassId'),
        is_standalone: formData.get('isStandalone'),
        lab_questions: formData.get('labQuestions'),
        takeaways: formData.get('takeaways'),
        takeaways_es: formData.get('takeawaysEs'),
        resource_urls: formData.get('resourceUrls'),
        stripe_product_id: formData.get('stripeProductId'),
        price_id: formData.get('priceId'),
    };
}

export async function createChapter(formData: FormData) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(chapterSchema, chapterInput(formData));
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { data: chapter, error: chapterError } = await auth.supabase
        .from('chapters')
        .insert(parsed.data)
        .select()
        .single();
    if (chapterError) {
        console.error("Chapter creation error:", chapterError);
        return { success: false, error: chapterError.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');
    revalidatePath(`/vault/foundations/${parsed.data.slug}`);
    revalidatePath(`/${formData.get('locale') || 'en'}/vault/foundations/${parsed.data.slug}`);

    return { success: true, chapter };
}

export async function updateChapter(chapterId: string, formData: FormData) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Chapter id'), chapterId);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(chapterSchema, chapterInput(formData));
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error: chapterError } = await auth.supabase
        .from('chapters')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', idParsed.data);

    if (chapterError) {
        return { success: false, error: chapterError.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');
    revalidatePath(`/vault/foundations/${parsed.data.slug}`);
    revalidatePath(`/${formData.get('locale') || 'en'}/vault/foundations/${parsed.data.slug}`);

    return { success: true };
}

export async function deleteChapter(chapterId: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Chapter id'), chapterId);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase
        .from('chapters')
        .delete()
        .eq('id', idParsed.data);

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
            masterclasses (
                title
            )
        `)
        .order('order_index', { ascending: true });

    if (error) {
        console.error("Error fetching chapters:", error);
        return { success: false, error: error.message, chapters: [] };
    }

    return { success: true, chapters: data || [] };
}
