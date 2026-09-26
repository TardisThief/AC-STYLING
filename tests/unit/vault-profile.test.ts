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

// Question definitions are paid content, read through the service role since
// migration 30 (tests/integration/paid-content.test.ts covers the loader).
const loadLabQuestionsFor = vi.fn(async (ids: string[]) => { void ids; return new Map() })
vi.mock('@/app/lib/paid-content', () => ({
    loadLabQuestionsFor: (ids: string[]) => loadLabQuestionsFor(ids),
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

            // Mock essence responses query (hers only)
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({
                    data: [{ question_key: 'style_words', answer_value: 'elegant', chapter_id: 'chapter-1' }],
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

            // Mock essence responses with style_words (hers only)
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({
                    data: [
                        { question_key: 'style_words', answer_value: 'elegant', chapter_id: 'chapter-1' },
                        { question_key: 'archetype', answer_value: 'Classic', chapter_id: 'chapter-2' },
                    ],
                    error: null,
                }),
            })

            const result = await getProfileHubData()

            expect(result?.essence.styleWords).toContain('elegant')
            expect(result?.essence.archetype).toContain('Classic')
            // Only the chapters she answered are read, never the whole catalogue.
            expect(loadLabQuestionsFor).toHaveBeenCalledWith(['chapter-1', 'chapter-2'])
        })
    })
})
