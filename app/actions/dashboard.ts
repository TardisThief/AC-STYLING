
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

    // Handle errors and edge cases early
    if (totalError) {
        console.error("Error fetching chapter count:", totalError);
        return { isComplete: false, progress: 0 };
    }

    // If no chapters exist or count is null, user is effectively "complete"
    if (totalChapters === null || totalChapters === 0) {
        return { isComplete: true, progress: 100 };
    }

    // 2. Get user's completed chapters
    const { data: completed, error: progressError } = await supabase
        .from('user_progress')
        .select('content_id')
        .eq('user_id', user.id);

    // Handle errors gracefully
    if (progressError) {
        console.error("Error fetching user progress:", progressError);
        return { isComplete: false, progress: 0 };
    }

    // Null-safe filter: check content_id exists and contains masterclass paths
    const completedMasterclassChapters = (completed ?? []).filter(
        p => p.content_id && (p.content_id.includes('foundations') || p.content_id.includes('masterclass'))
    ).length;

    return {
        isComplete: completedMasterclassChapters >= totalChapters,
        progress: Math.round((completedMasterclassChapters / totalChapters) * 100)
    };
}

