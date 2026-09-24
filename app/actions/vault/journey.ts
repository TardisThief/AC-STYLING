'use server';

import { createClient } from '@/utils/supabase/server';
import { canAccessMasterclass, getAccessLevel } from '@/utils/access-level';

export interface JourneyStats {
    memberSince: string | null;
    hasFullAccess: boolean;
    /** Full access or the Masterclass Pass: every masterclass, current and future. */
    hasAllMasterclasses: boolean;
    masterclassesAccessCount: number;
    essenceLabsCompleted: number;
    coursesAccessCount: number;
    totalMasterclasses: number;
}

export async function getJourneyStats(targetUserId?: string): Promise<JourneyStats | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const userId = targetUserId || user.id;

    const [profileRes, grantsRes, progressRes, masterclassCountRes] = await Promise.all([
        supabase
            .from('profiles')
            .select('created_at, has_full_unlock, has_masterclass_pass, access_expires_at')
            .eq('id', userId)
            .single(),
        supabase
            .from('user_access_grants')
            .select('grant_type')
            .eq('user_id', userId)
            // Counting a lapsed grant would tell her she still has something
            // she cannot open.
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
        supabase
            .from('user_progress')
            .select('activity_type')
            .eq('user_id', userId)
            .like('activity_type', 'lab_unlocked:%'),
        supabase
            .from('masterclasses')
            .select('id', { count: 'exact', head: true }),
    ]);

    const profile = profileRes.data;
    const grants = grantsRes.data || [];
    const progress = progressRes.data || [];
    const totalMasterclasses = masterclassCountRes.count || 0;

    const masterclassGrants = grants.filter(g => g.grant_type === 'masterclass');
    const courseGrants = grants.filter(g => g.grant_type === 'course');

    return {
        memberSince: profile?.created_at || null,
        hasFullAccess: getAccessLevel(profile) === 'all_access',
        hasAllMasterclasses: canAccessMasterclass(profile),
        masterclassesAccessCount: masterclassGrants.length,
        essenceLabsCompleted: progress.length,
        coursesAccessCount: courseGrants.length,
        totalMasterclasses,
    };
}
