import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockFrom = vi.fn()
const mockAuth = {
    getUser: vi.fn(),
    signUp: vi.fn(),
}

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: mockAuth,
        from: mockFrom,
    })),
}))

vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}))

vi.mock('next/headers', () => ({
    headers: vi.fn(),
}))

// Import after mocks
import { linkIntakeProfile } from '@/app/actions/auth'

describe('Auth Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('linkIntakeProfile', () => {
        it('returns error when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await linkIntakeProfile('test-token-123')

            expect(result.error).toBe('Not authenticated')
        })

        it('returns message when token not found or already processed', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Mock profile lookup - not found
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                neq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
            })

            const result = await linkIntakeProfile('invalid-token')

            expect(result.message).toContain('Token already processed')
        })

        it('transfers data and returns success for valid token', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Mock invite profile lookup - found
            const mockInviteProfile = {
                id: 'invite-profile-456',
                studio_permissions: { lookbook: true, wardrobe: true },
            }

            // First call: profile lookup
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                neq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockInviteProfile, error: null }),
            })

            // Transfer calls (wardrobe_items, tailor_cards, lookbooks)
            mockFrom.mockReturnValue({
                update: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
                delete: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
            })

            const result = await linkIntakeProfile('valid-token-123')

            expect(result.success).toBe(true)
        })

        it('archives invite profile if delete fails', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            const mockInviteProfile = {
                id: 'invite-profile-456',
                studio_permissions: {},
            }

            // Mock profile lookup
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                neq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockInviteProfile, error: null }),
            })

            // Mock transfer updates
            mockFrom.mockReturnValue({
                update: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
                delete: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: { message: 'FK Violation' } }),
                })),
            })

            const result = await linkIntakeProfile('valid-token-123')

            // Should still return success (fallback archives)
            expect(result.success).toBe(true)
        })
    })
})
