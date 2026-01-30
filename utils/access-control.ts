import { createClient } from '@/utils/supabase/server'

/**
 * Checks if a user has access to a specific object (Masterclass, Chapter/Course).
 * This uses the database-level `check_access` RPC function which checks:
 * 1. Global "Full Unlock" on the profile
 * 2. Specific entries in `user_access_grants`
 * 
 * @param userId The UUID of the user
 * @param objectId The UUID of the Masterclass or Chapter/Course
 * @returns boolean true if access is granted
 */
export async function checkAccess(userId: string, objectId: string): Promise<boolean> {
    if (!userId || !objectId) return false

    const supabase = await createClient()

    const { data, error } = await supabase.rpc('check_access', {
        check_user_id: userId,
        check_object_id: objectId
    })

    if (error) {
        console.error(`Error checking access for user ${userId} on object ${objectId}:`, error)
        return false
    }

    return !!data
}
