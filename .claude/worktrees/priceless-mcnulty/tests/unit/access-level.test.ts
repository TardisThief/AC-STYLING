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
