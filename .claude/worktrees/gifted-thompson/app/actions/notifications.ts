'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

export type NotificationType =
    | 'service_booking'
    | 'wardrobe_item'
    | 'general'
    | 'masterclass_purchase'
    | 'course_sale'
    | 'offer_sale'
    | 'sale'
    | 'question';
export type NotificationStatus = 'unread' | 'read' | 'actioned' | 'archived';

export interface AdminNotification {
    id: string;
    created_at: string;
    type: NotificationType;
    title: string;
    message: string | null;
    user_id: string | null;
    reference_id: string | null;
    status: NotificationStatus;
    action_taken: string | null;
    metadata: Record<string, any>;
    profiles?: {
        full_name: string | null;
        avatar_url: string | null;
    };
}

interface GetNotificationsFilter {
    type?: NotificationType;
    status?: NotificationStatus;
    limit?: number;
}

/**
 * Fetch admin notifications with optional filtering
 */
export async function getAdminNotifications(filter?: GetNotificationsFilter): Promise<{
    success: boolean;
    data?: AdminNotification[];
    error?: string;
}> {
    const supabase = createAdminClient();

    let query = supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false });

    if (filter?.type) {
        query = query.eq('type', filter.type);
    }

    if (filter?.status) {
        query = query.eq('status', filter.status);
    }

    if (filter?.limit) {
        query = query.limit(filter.limit);
    }

    // 1. Fetch Admin Notifications
    const { data: notifications, error: notifError } = await query;

    if (notifError) {
        console.error('Error fetching notifications:', notifError);
        return { success: false, error: notifError.message };
    }

    let combinedData = [...(notifications as AdminNotification[])];

    // 2. Fetch Pending Wardrobe Items (if not filtered out)
    // Only fetch if we are looking for 'all', 'wardrobe_item', or specific statuses that match 'inbox'
    const includeWardrobe = !filter?.type || filter.type === 'wardrobe_item';
    const includeInboxStatus = !filter?.status || filter.status === 'unread';

    if (includeWardrobe && includeInboxStatus) {
        const { data: wardrobeItems, error: wardrobeError } = await supabase
            .from('wardrobe_items')
            .select(`
                *,
                profiles:user_id ( full_name, avatar_url )
            `)
            .eq('status', 'inbox')
            .order('created_at', { ascending: false })
            .limit(filter?.limit || 50);

        if (!wardrobeError && wardrobeItems) {
            const mappedItems: AdminNotification[] = wardrobeItems.map(item => ({
                id: item.id,
                created_at: item.created_at,
                type: 'wardrobe_item',
                title: 'New Wardrobe Item',
                message: item.client_note || 'No notes provided.',
                user_id: item.user_id,
                reference_id: item.id,
                status: 'unread', // Inbox items are treated as unread
                action_taken: null,
                metadata: {
                    imageUrl: item.image_url,
                    brand: item.brand
                },
                profiles: item.profiles
            }));
            combinedData = [...combinedData, ...mappedItems];
        }
    }

    // 3. Sort Combined Data by Created At
    combinedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply overall limit if needed (though we limited individual queries, the sum might exceed)
    if (filter?.limit) {
        combinedData = combinedData.slice(0, filter.limit);
    }

    return { success: true, data: combinedData };
}

/**
 * Get count of unread notifications
 */
export async function getUnreadNotificationCount(): Promise<number> {
    const supabase = createAdminClient();

    // 1. Unread Admin Notifications
    const { count: notifCount, error: notifError } = await supabase
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');

    if (notifError) console.error('Error counting notifications:', notifError);

    // 2. Pending Wardrobe Items (Inbox)
    // Wardrobe items in 'inbox' status are essentially unread notifications for the admins
    const { count: inboxCount, error: inboxError } = await supabase
        .from('wardrobe_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'inbox');

    if (inboxError) console.error('Error counting inbox items:', inboxError);

    return (notifCount || 0) + (inboxCount || 0);
}

/**
 * Mark a notification as read
 * For wardrobe items, this sets status to 'keep' (Approve)
 */
export async function markNotificationAsRead(id: string, type?: NotificationType): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

    if (type === 'wardrobe_item') {
        const { error } = await supabase
            .from('wardrobe_items')
            .update({ status: 'keep' })
            .eq('id', id);

        if (error) {
            console.error('Error marking wardrobe item as read (keep):', error);
            return { success: false, error: error.message };
        }
    } else {
        const { error } = await supabase
            .from('admin_notifications')
            .update({ status: 'read' })
            .eq('id', id);

        if (error) {
            console.error('Error marking notification as read:', error);
            return { success: false, error: error.message };
        }
    }

    revalidatePath('/studio');
    return { success: true };
}

/**
 * Update notification status and optionally record action taken
 */
export async function updateNotificationStatus(
    id: string,
    newStatus: NotificationStatus,
    actionTaken?: string,
    type?: NotificationType
): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

    if (type === 'wardrobe_item') {
        // Map NotificationStatus/Action to Wardrobe Status
        // actionTaken usually holds specific actions like 'donate', 'repair'
        let wardrobeStatus = 'keep';
        if (actionTaken === 'donate') wardrobeStatus = 'donate';
        if (actionTaken === 'repair') wardrobeStatus = 'repair';

        const { error } = await supabase
            .from('wardrobe_items')
            .update({ status: wardrobeStatus })
            .eq('id', id);

        if (error) return { success: false, error: error.message };
    } else {
        const updateData: any = { status: newStatus };
        if (actionTaken) {
            updateData.action_taken = actionTaken;
        }

        const { error } = await supabase
            .from('admin_notifications')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error('Error updating notification status:', error);
            return { success: false, error: error.message };
        }
    }

    revalidatePath('/studio');
    return { success: true };
}

/**
 * Archive a notification
 */
export async function archiveNotification(id: string, type?: NotificationType): Promise<{ success: boolean; error?: string }> {
    // For wardrobe items, 'archive' might mean 'donate' or just ignoring?
    // Let's assume 'donate' for now or just generic update
    return updateNotificationStatus(id, 'archived', undefined, type);
}

/**
 * Mark all unread notifications as read
 */
export async function markAllAsRead(): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from('admin_notifications')
        .update({ status: 'read' })
        .eq('status', 'unread');

    if (error) {
        console.error('Error marking all as read:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/studio');
    return { success: true };
}
