import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockFrom = vi.fn()
const mockAuth = { getUser: vi.fn() }

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: mockAuth,
        from: mockFrom,
    })),
}))

// Import after mocks
import { getProfileHubData } from '@/app/actions/vault/profile'

describe('Vault Profile Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getProfileHubData', () => {
        it('returns null when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await getProfileHubData()

            expect(result).toBeNull()
        })

        it('returns profile data for authenticated user', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Mock profile query
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { id: 'user-123', full_name: 'Test User', role: 'user' },
                    error: null,
                }),
            })

            // Mock tailor card query
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { measurements: { height: 170 }, updated_at: '2026-01-01' },
                    error: null,
                }),
            })

            // Mock essence responses query
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockResolvedValue({
                    data: [{ question_key: 'style_words', answer_value: 'elegant' }],
                    error: null,
                }),
            })

            // Mock chapters query for lab questions
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            })

            const result = await getProfileHubData()

            expect(result).not.toBeNull()
            expect(result?.profile).toBeDefined()
            expect(result?.profile.full_name).toBe('Test User')
            expect(result?.tailorCard).toBeDefined()
            expect(result?.essence).toBeDefined()
        })

        it('returns essence data mapped correctly', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Mock profile
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null }),
            })

            // Mock tailor card
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
            })

            // Mock essence responses with style_words
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockResolvedValue({
                    data: [
                        { question_key: 'style_words', answer_value: 'elegant' },
                        { question_key: 'archetype', answer_value: 'Classic' },
                    ],
                    error: null,
                }),
            })

            // Mock chapters
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockResolvedValue({ data: [], error: null }),
            })

            const result = await getProfileHubData()

            expect(result?.essence.styleWords).toContain('elegant')
            expect(result?.essence.archetype).toContain('Classic')
        })
    })
})
