
'use server';

import { createClient } from "@/utils/supabase/server";

export type PulseContent = {
    id: string; // Add ID for keys
    type: 'continue' | 'new_learning' | 'new_boutique' | 'news';
    title: string;
    subtitle: string;
    image_url: string;
    link_url: string;
    label: string;
};

export async function getDashboardPulse(): Promise<PulseContent[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const items: PulseContent[] = [];

    // 1. ACTIVE LEARNING (Jump Back In)
    const { data: progress } = await supabase
        .from('user_progress')
        .select('content_id, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(1); // Just get the very last one

    if (progress && progress.length > 0) {
        const lastSlug = progress[0].content_id.split('/').pop();
        if (lastSlug) {
            const { data: lastChapter } = await supabase
                .from('chapters')
                .select('*')
                .eq('slug', lastSlug)
                .single();

            if (lastChapter) {
                // Find NEXT chapter
                let query = supabase
                    .from('chapters')
                    .select('*')
                    .gt('order_index', lastChapter.order_index)
                    .order('order_index', { ascending: true })
                    .limit(1);

                if (lastChapter.masterclass_id) {
                    query = query.eq('masterclass_id', lastChapter.masterclass_id);
                } else if (lastChapter.is_standalone) {
                    query = query.eq('is_standalone', true);
                }

                const { data: nextChapter } = await query.single();
                if (nextChapter) {
                    items.push({
                        id: `continue-${nextChapter.id}`,
                        type: 'continue',
                        title: nextChapter.title,
                        subtitle: `Continue: ${lastChapter.masterclass_id ? 'Masterclass' : 'Course'}`,
                        image_url: nextChapter.thumbnail_url || 'https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?q=80&w=2083&auto=format&fit=crop',
                        link_url: `/vault/${lastChapter.masterclass_id ? 'foundations' : 'courses'}/${nextChapter.slug}`,
                        label: 'Jump Back In'
                    });
                }
            }
        }
    }

    // 2. NEW BOUTIQUE ITEM
    const { data: latestItem } = await supabase
        .from('boutique_items')
        .select('*, brand:partner_brands(name)')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (latestItem) {
        items.push({
            id: `boutique-${latestItem.id}`,
            type: 'new_boutique',
            title: latestItem.name,
            subtitle: `Just arrived from ${latestItem.brand?.name}`,
            image_url: latestItem.image_url,
            link_url: '/vault/boutique',
            label: 'The Edit'
        });
    }

    // 3. NEW LEARNING (Latest Chapter)
    const { data: latestChapter } = await supabase
        .from('chapters')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (latestChapter) {
        // Avoid duplicate if it's the same as "Continue" (unlikely but possible if new user)
        // Simple check by ID or title
        const isDuplicate = items.some(i => i.title === latestChapter.title);
        if (!isDuplicate) {
            items.push({
                id: `new-${latestChapter.id}`,
                type: 'new_learning',
                title: latestChapter.title,
                subtitle: "Freshly added content",
                image_url: latestChapter.thumbnail_url || 'https://images.unsplash.com/photo-1529139574466-a302d2052574?q=80&w=2070&auto=format&fit=crop',
                link_url: `/vault/${latestChapter.masterclass_id ? 'foundations' : 'courses'}/${latestChapter.slug}`,
                label: 'New Release'
            });
        }
    }

    // Fallback? If empty, maybe add a generic one
    if (items.length === 0) {
        items.push({
            id: 'default-1',
            type: 'news',
            title: "Welcome to the Lab",
            subtitle: "Start your journey today.",
            image_url: 'https://images.unsplash.com/photo-1490481651871-ab52661227ed?q=80&w=2070&auto=format&fit=crop',
            link_url: '/vault/foundations',
            label: 'Get Started'
        });
    }

    return items.slice(0, 3);
}

export async function getMasterclassCompletionStatus() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { isComplete: false, progress: 0 };

    // 1. Get total active masterclass chapters
    const { count: totalChapters, error: totalError } = await supabase
        .from('chapters')
        .select('*', { count: 'exact', head: true })
        .not('masterclass_id', 'is', null);

    if (totalError || totalChapters === null) return { isComplete: false, progress: 0 };

    // 2. Get user's completed chapters (that belong to a masterclass)
    // We need to join or filter. Since user_progress stores content_id like "masterclass-slug/chapter-slug" 
    // or just the chapter_id if we changed schema. 
    // Checking `user_progress` table schema might be needed, but assuming standard:
    // Actually `user_progress` usually links to `content_id`.
    // Let's assume we can count unique completed chapters.

    // Alternative: Check if there are any remaining chapters NOT in user_progress.
    // Simpler approach for now: Get all user progress, count how many match masterclass chapters.

    // Better: Get the latest chapter the user completed. If it's the last one in the DB, then complete? 
    // No, they might skip.

    // Robust approach:
    const { data: completed } = await supabase
        .from('user_progress')
        .select('content_id')
        .eq('user_id', user.id);

    // We need to know which of these content_ids correspond to masterclass chapters.
    // If content_id is the chapter slug or id? 
    // In `getDashboardPulse`, we split content_id by '/'. 
    // If the path contains 'foundations', it's masterclass.

    const completedMasterclassChapters = completed?.filter(p => p.content_id.includes('foundations') || p.content_id.includes('masterclass')).length || 0;

    // If total is 0, then effectively complete (or empty).
    if (totalChapters === 0) return { isComplete: true, progress: 100 };

    return {
        isComplete: completedMasterclassChapters >= totalChapters,
        progress: Math.round((completedMasterclassChapters / totalChapters) * 100)
    };
}
