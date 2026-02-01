/**
 * User Access Level Utility
 * 
 * Centralizes access level logic for testability and reuse.
 * This extracts the inline logic from page components.
 */

export type AccessLevel = 'all_access' | 'course_pass' | 'restricted' | 'basic';

export interface UserProfile {
    has_full_unlock?: boolean;
    has_course_pass?: boolean;
    is_guest?: boolean;
    active_studio_client?: boolean;
}

/**
 * Determines the access level for a user based on their profile.
 * 
 * Priority order:
 * 1. Full unlock = 'all_access'
 * 2. Course pass = 'course_pass'
 * 3. Guest = 'restricted'
 * 4. Default = 'basic'
 */
export function getAccessLevel(profile: UserProfile | null): AccessLevel {
    if (!profile) return 'restricted';

    // Full unlock takes priority
    if (profile.has_full_unlock) return 'all_access';

    // Course pass grants course access
    if (profile.has_course_pass) return 'course_pass';

    // Guests are restricted (preview only)
    if (profile.is_guest) return 'restricted';

    // Default: basic access (free content only)
    return 'basic';
}

/**
 * Checks if user can access masterclass content
 */
export function canAccessMasterclass(profile: UserProfile | null): boolean {
    const level = getAccessLevel(profile);
    return level === 'all_access';
}

/**
 * Checks if user can access course content
 */
export function canAccessCourse(profile: UserProfile | null): boolean {
    const level = getAccessLevel(profile);
    return level === 'all_access' || level === 'course_pass';
}

/**
 * Checks if user has studio client privileges
 */
export function hasStudioAccess(profile: UserProfile | null): boolean {
    if (!profile) return false;
    return profile.active_studio_client === true;
}
