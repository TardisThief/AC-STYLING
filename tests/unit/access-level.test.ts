/**
 * Spec B: Business Logic Tests - getAccessLevel
 */

import { describe, it, expect } from 'vitest'
import {
    getAccessLevel,
    canAccessMasterclass,
    canAccessCourse,
    hasStudioAccess,
    type UserProfile
} from '@/utils/access-level'

describe('Access Level Business Logic', () => {
    describe('getAccessLevel', () => {
        it('returns "all_access" for user with has_full_unlock: true', () => {
            const profile: UserProfile = { has_full_unlock: true }

            expect(getAccessLevel(profile)).toBe('all_access')
        })

        it('returns "restricted" for user with is_guest: true', () => {
            const profile: UserProfile = { is_guest: true }

            expect(getAccessLevel(profile)).toBe('restricted')
        })

        it('returns "course_pass" for user with has_course_pass: true', () => {
            const profile: UserProfile = { has_course_pass: true }

            expect(getAccessLevel(profile)).toBe('course_pass')
        })

        it('returns "restricted" for null profile', () => {
            expect(getAccessLevel(null)).toBe('restricted')
        })

        it('returns "basic" for regular user without special flags', () => {
            const profile: UserProfile = {
                has_full_unlock: false,
                is_guest: false,
                has_course_pass: false
            }

            expect(getAccessLevel(profile)).toBe('basic')
        })

        it('prioritizes full_unlock over is_guest', () => {
            const profile: UserProfile = {
                has_full_unlock: true,
                is_guest: true
            }

            // Full unlock should take priority
            expect(getAccessLevel(profile)).toBe('all_access')
        })

        it('prioritizes has_course_pass over is_guest', () => {
            const profile: UserProfile = {
                has_course_pass: true,
                is_guest: true
            }

            expect(getAccessLevel(profile)).toBe('course_pass')
        })
    })

    describe('canAccessMasterclass', () => {
        it('returns true for all_access users', () => {
            expect(canAccessMasterclass({ has_full_unlock: true })).toBe(true)
        })

        it('returns false for course_pass users', () => {
            expect(canAccessMasterclass({ has_course_pass: true })).toBe(false)
        })

        it('returns false for guests', () => {
            expect(canAccessMasterclass({ is_guest: true })).toBe(false)
        })

        it('returns false for basic users', () => {
            expect(canAccessMasterclass({})).toBe(false)
        })
    })

    describe('masterclass pass', () => {
        it('returns "masterclass_pass" as the level', () => {
            expect(getAccessLevel({ has_masterclass_pass: true })).toBe('masterclass_pass')
        })

        it('opens every masterclass', () => {
            expect(canAccessMasterclass({ has_masterclass_pass: true })).toBe(true)
        })

        it('does not open standalone courses', () => {
            expect(canAccessCourse({ has_masterclass_pass: true })).toBe(false)
        })

        it('combines with a course pass instead of being shadowed by it', () => {
            const both = { has_course_pass: true, has_masterclass_pass: true }
            expect(canAccessMasterclass(both)).toBe(true)
            expect(canAccessCourse(both)).toBe(true)
        })
    })

    describe('canAccessCourse', () => {
        it('returns true for all_access users', () => {
            expect(canAccessCourse({ has_full_unlock: true })).toBe(true)
        })

        it('returns true for course_pass users', () => {
            expect(canAccessCourse({ has_course_pass: true })).toBe(true)
        })

        it('returns false for guests', () => {
            expect(canAccessCourse({ is_guest: true })).toBe(false)
        })

        it('returns false for basic users', () => {
            expect(canAccessCourse({})).toBe(false)
        })
    })

    describe('the one-year term', () => {
        const DAY = 24 * 60 * 60 * 1000
        const future = new Date(Date.now() + 90 * DAY).toISOString()
        const past = new Date(Date.now() - DAY).toISOString()

        it('honours a pass that is still inside its year', () => {
            expect(getAccessLevel({ has_full_unlock: true, access_expires_at: future })).toBe('all_access')
            expect(canAccessMasterclass({ has_masterclass_pass: true, access_expires_at: future })).toBe(true)
            expect(canAccessCourse({ has_course_pass: true, access_expires_at: future })).toBe(true)
        })

        it('ignores the flags once the year has run out', () => {
            // The columns still say true -- nothing clears them. The expiry is
            // the only thing standing between a lapsed member and the library.
            expect(getAccessLevel({ has_full_unlock: true, access_expires_at: past })).toBe('basic')
            expect(canAccessMasterclass({ has_masterclass_pass: true, access_expires_at: past })).toBe(false)
            expect(canAccessCourse({ has_course_pass: true, access_expires_at: past })).toBe(false)
        })

        it('treats a null expiry as perpetual, for everyone who bought before the term', () => {
            expect(getAccessLevel({ has_full_unlock: true, access_expires_at: null })).toBe('all_access')
            expect(canAccessMasterclass({ has_masterclass_pass: true })).toBe(true)
        })

        it('still reports a lapsed guest as restricted rather than basic', () => {
            expect(getAccessLevel({ has_full_unlock: true, is_guest: true, access_expires_at: past }))
                .toBe('restricted')
        })
    })

    describe('hasStudioAccess', () => {
        it('returns true for active studio clients', () => {
            expect(hasStudioAccess({ active_studio_client: true })).toBe(true)
        })

        it('returns false for non-studio users', () => {
            expect(hasStudioAccess({ active_studio_client: false })).toBe(false)
        })

        it('returns false for null profile', () => {
            expect(hasStudioAccess(null)).toBe(false)
        })
    })
})
