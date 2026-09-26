"use server";

import { createAdminClient } from '@/utils/supabase/admin';
import { MASTERCLASS_CATALOG_COLUMNS } from '@/app/lib/chapter-columns';
import { requireAdmin } from '@/app/lib/auth-guards';
import { parseInput, uuid } from '@/app/lib/validation/parse';
import { masterclassSchema } from '@/app/lib/validation/masterclasses';
import { revalidatePath, updateTag } from 'next/cache';
import { VAULT_CATALOG_TAG } from '@/app/lib/cache-tags';

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
        resource_urls: formData.get('resourceUrls'),
        stripe_product_id: formData.get('stripeProductId'),
        price_id: formData.get('priceId'),
        is_published: formData.get('isPublished'),
        price_display: formData.get('priceDisplay'),
        runtime_minutes: formData.get('runtimeMinutes'),
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
        // Not `.select()`: since migration 30 even an admin's session cannot
        // read resource_urls (column privileges do not know about roles in
        // profiles). The caller does not need it back.
        .select(MASTERCLASS_CATALOG_COLUMNS)
        .single();
    if (error) {
        return { success: false, error: error.message };
    }

    // The public sales page reads this catalogue through a tagged cache.
    // Nothing invalidated that tag, so an edit here took up to an hour to
    // appear on /vault-access despite the comment in vault-catalog.ts
    // claiming admin writes did this.
    updateTag(VAULT_CATALOG_TAG);
    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');
    // A masterclass's resources render inside every one of its module pages,
    // so an edit here goes stale there unless the whole route is invalidated.
    revalidatePath('/vault/foundations/[slug]', 'page');

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

    // The public sales page reads this catalogue through a tagged cache.
    // Nothing invalidated that tag, so an edit here took up to an hour to
    // appear on /vault-access despite the comment in vault-catalog.ts
    // claiming admin writes did this.
    updateTag(VAULT_CATALOG_TAG);
    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');
    // A masterclass's resources render inside every one of its module pages,
    // so an edit here goes stale there unless the whole route is invalidated.
    revalidatePath('/vault/foundations/[slug]', 'page');

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

    // The public sales page reads this catalogue through a tagged cache.
    // Nothing invalidated that tag, so an edit here took up to an hour to
    // appear on /vault-access despite the comment in vault-catalog.ts
    // claiming admin writes did this.
    updateTag(VAULT_CATALOG_TAG);
    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true };
}

/**
 * Full masterclass rows for the admin console, resources included.
 *
 * Service role, because migration 30 removed resource_urls from what any
 * session may read, and the console edits it. requireAdmin() first, always —
 * the same arrangement as getChapters().
 */
export async function getMasterclasses() {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error, masterclasses: [] };

    const { data, error } = await createAdminClient()
        .from('masterclasses')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) {
        return { success: false, error: error.message, masterclasses: [] };
    }

    return { success: true, masterclasses: data };
}
