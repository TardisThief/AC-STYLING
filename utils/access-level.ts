/**
 * User Access Level Utility
 * 
 * Centralizes access level logic for testability and reuse.
 * This extracts the inline logic from page components.
 */

export type AccessLevel = 'all_access' | 'course_pass' | 'masterclass_pass' | 'restricted' | 'basic';

export interface UserProfile {
    has_full_unlock?: boolean;
    has_course_pass?: boolean;
    has_masterclass_pass?: boolean;
    is_guest?: boolean;
    active_studio_client?: boolean;
}

/**
 * Determines the access level for a user based on their profile.
 * 
 * Priority order:
 * 1. Full unlock = 'all_access'
 * 2. Course pass = 'course_pass'
 * 3. Masterclass pass = 'masterclass_pass'
 * 4. Guest = 'restricted'
 * 5. Default = 'basic'
 *
 * The two passes are independent and a buyer can hold both, which a single
 * level cannot express — so the `canAccess*` checks below read the flags, not
 * this level.
 */
export function getAccessLevel(profile: UserProfile | null): AccessLevel {
    if (!profile) return 'restricted';

    // Full unlock takes priority
    if (profile.has_full_unlock) return 'all_access';

    // Course pass grants course access
    if (profile.has_course_pass) return 'course_pass';

    // Masterclass pass grants every masterclass
    if (profile.has_masterclass_pass) return 'masterclass_pass';

    // Guests are restricted (preview only)
    if (profile.is_guest) return 'restricted';

    // Default: basic access (free content only)
    return 'basic';
}

/**
 * Checks if user can access masterclass content
 */
export function canAccessMasterclass(profile: UserProfile | null): boolean {
    if (!profile) return false;
    return Boolean(profile.has_full_unlock || profile.has_masterclass_pass);
}

/**
 * Checks if user can access course content
 */
export function canAccessCourse(profile: UserProfile | null): boolean {
    if (!profile) return false;
    return Boolean(profile.has_full_unlock || profile.has_course_pass);
}

/**
 * Checks if user has studio client privileges
 */
export function hasStudioAccess(profile: UserProfile | null): boolean {
    if (!profile) return false;
    return profile.active_studio_client === true;
}
