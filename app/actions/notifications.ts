'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

export type NotificationType = 'service_booking' | 'masterclass_purchase' | 'sale' | 'general';
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

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching notifications:', error);
        return { success: false, error: error.message };
    }

    return { success: true, data: data as AdminNotification[] };
}

/**
 * Get count of unread notifications
 */
export async function getUnreadNotificationCount(): Promise<number> {
    const supabase = createAdminClient();

    const { count, error } = await supabase
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');

    if (error) {
        console.error('Error counting notifications:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from('admin_notifications')
        .update({ status: 'read' })
        .eq('id', id);

    if (error) {
        console.error('Error marking notification as read:', error);
        return { success: false, error: error.message };
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
    actionTaken?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

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

    revalidatePath('/studio');
    return { success: true };
}

/**
 * Archive a notification
 */
export async function archiveNotification(id: string): Promise<{ success: boolean; error?: string }> {
    return updateNotificationStatus(id, 'archived');
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
