import { describe, it, expect, vi, beforeEach } from 'vitest'

// Local mock so each test controls getUser + profile role
const mockAuth = { getUser: vi.fn() }
const mockSingle = vi.fn()
const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockSingle,
}))

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: mockAuth,
        from: mockFrom,
    })),
}))

import { requireUser, requireAdmin } from '@/app/lib/auth-guards'

describe('auth-guards', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('requireUser', () => {
        it('rejects an unauthenticated caller', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await requireUser()

            expect(result.ok).toBe(false)
            if (!result.ok) expect(result.error).toBe('Unauthorized')
        })

        it('accepts an authenticated caller and returns the user', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

            const result = await requireUser()

            expect(result.ok).toBe(true)
            if (result.ok) expect(result.user.id).toBe('user-1')
        })
    })

    describe('requireAdmin', () => {
        it('rejects an unauthenticated caller', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await requireAdmin()

            expect(result.ok).toBe(false)
            if (!result.ok) expect(result.error).toBe('Unauthorized')
        })

        it('rejects an authenticated non-admin caller', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
            mockSingle.mockResolvedValue({ data: { role: 'user' }, error: null })

            const result = await requireAdmin()

            expect(result.ok).toBe(false)
            if (!result.ok) expect(result.error).toBe('Forbidden')
        })

        it('accepts an admin caller', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
            mockSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })

            const result = await requireAdmin()

            expect(result.ok).toBe(true)
            if (result.ok) expect(result.user.id).toBe('admin-1')
        })

        it('rejects when the profile row is missing', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'ghost' } } })
            mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

            const result = await requireAdmin()

            expect(result.ok).toBe(false)
            if (!result.ok) expect(result.error).toBe('Forbidden')
        })
    })
})
