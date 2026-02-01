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
import { saveEssenceResponse, getEssenceProgress, getFlatEssenceAnswers } from '@/app/actions/essence-lab'

describe('Essence Lab Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('saveEssenceResponse', () => {
        it('returns error when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await saveEssenceResponse(null, 'chapter-1', 'intro', 'style_words', 'elegant')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Unauthorized')
        })

        it('saves response for authenticated user', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                upsert: vi.fn().mockResolvedValue({ error: null }),
            })

            const result = await saveEssenceResponse(
                'masterclass-456',
                'chapter-1',
                'intro',
                'style_words',
                'elegant'
            )

            expect(result.success).toBe(true)
        })

        it('handles standalone masterclass ID', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            const mockUpsert = vi.fn().mockResolvedValue({ error: null })
            mockFrom.mockReturnValue({ upsert: mockUpsert })

            await saveEssenceResponse('standalone', 'chapter-1', 'intro', 'key', 'value')

            // Should convert 'standalone' to null
            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({ masterclass_id: null }),
                expect.any(Object)
            )
        })
    })

    describe('getEssenceProgress', () => {
        it('returns empty object when not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await getEssenceProgress('masterclass-123')

            expect(result).toEqual({})
        })

        it('returns mapped responses for authenticated user', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                then: vi.fn().mockResolvedValue({
                    data: [
                        { question_key: 'style_words', answer_value: 'elegant', chapter_slug: 'intro', updated_at: '2026-01-01' },
                    ],
                    error: null,
                }),
            })

            // Need to mock the chain properly
            mockFrom.mockReturnValue({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        eq: vi.fn().mockResolvedValue({
                            data: [
                                { question_key: 'style_words', answer_value: 'elegant', chapter_slug: 'intro', updated_at: '2026-01-01' },
                            ],
                            error: null,
                        }),
                    })),
                })),
            })

            const result = await getEssenceProgress('masterclass-123')

            expect(result).toHaveProperty('style_words')
        })
    })

    describe('getFlatEssenceAnswers', () => {
        it('returns empty array when not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await getFlatEssenceAnswers()

            expect(result).toEqual([])
        })
    })
})
