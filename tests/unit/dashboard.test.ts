import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChainableMock } from '../utils/supabase-mock'

// Mock Supabase using proper chainable mocks
const mockFrom = vi.fn()
const mockAuth = { getUser: vi.fn() }

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: mockAuth,
        from: mockFrom,
    })),
}))

// Import after mocks
import { getDashboardPulse, getMasterclassCompletionStatus } from '@/app/actions/dashboard'

describe('Dashboard Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getDashboardPulse', () => {
        it('returns empty array when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await getDashboardPulse()

            expect(result).toEqual([])
        })

        it('returns default item when no progress or content exists', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // getDashboardPulse makes 3 queries minimum:
            // 1. user_progress - empty array
            mockFrom.mockReturnValueOnce(createChainableMock({ data: [], error: null }))
            // 2. boutique_items - null (no items)
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: null }))
            // 3. chapters - null (no items)
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: null }))

            const result = await getDashboardPulse()

            // Should return default fallback item
            expect(result).toHaveLength(1)
            expect(result[0].type).toBe('news')
            expect(result[0].title).toBe('Welcome to the Lab')
        })

        it('returns boutique item when available', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // First query (user_progress) - empty
            mockFrom.mockReturnValueOnce(createChainableMock({ data: [], error: null }))

            // Second query (boutique_items) - has item
            mockFrom.mockReturnValueOnce(createChainableMock({
                data: { id: 'item-1', name: 'Silk Scarf', image_url: 'https://img.url', brand: { name: 'Zara' } },
                error: null,
            }))

            // Third query (chapters) - empty
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: null }))

            const result = await getDashboardPulse()

            expect(result.some(item => item.type === 'new_boutique')).toBe(true)
        })

        it('returns continue learning item when user has progress', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // First query (user_progress) - has progress
            mockFrom.mockReturnValueOnce(createChainableMock({
                data: [{ content_id: 'foundations/basics', completed_at: '2026-01-01' }],
                error: null,
            }))

            // Second query (chapters) - find last chapter by slug
            mockFrom.mockReturnValueOnce(createChainableMock({
                data: { id: 'ch-1', slug: 'basics', title: 'Basics', order_index: 1, masterclass_id: 'mc-1' },
                error: null,
            }))

            // Third query (next chapter)
            mockFrom.mockReturnValueOnce(createChainableMock({
                data: { id: 'ch-2', slug: 'colors', title: 'Color Theory', order_index: 2, masterclass_id: 'mc-1', thumbnail_url: 'https://img.url' },
                error: null,
            }))

            // Fourth query (boutique_items)
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: null }))

            // Fifth query (latest chapters)
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: null }))

            const result = await getDashboardPulse()

            const continueItem = result.find(item => item.type === 'continue')
            expect(continueItem).toBeDefined()
            expect(continueItem?.title).toBe('Color Theory')
        })
    })

    describe('getMasterclassCompletionStatus', () => {
        it('returns incomplete when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await getMasterclassCompletionStatus()

            expect(result.isComplete).toBe(false)
            expect(result.progress).toBe(0)
        })

        it('returns 100% when no chapters exist', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Mock total chapters count - 0
            mockFrom.mockReturnValueOnce(createChainableMock({ count: 0, error: null }))

            const result = await getMasterclassCompletionStatus()

            expect(result.isComplete).toBe(true)
            expect(result.progress).toBe(100)
        })

        it('returns 0% when no progress exists', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Total chapters - 10
            mockFrom.mockReturnValueOnce(createChainableMock({ count: 10, error: null }))

            // User progress - empty (no masterclass chapters completed)
            mockFrom.mockReturnValueOnce(createChainableMock({
                data: [{ content_id: 'courses/something' }], // Only course, not masterclass
                error: null,
            }))

            const result = await getMasterclassCompletionStatus()

            expect(result.isComplete).toBe(false)
            expect(result.progress).toBe(0)
        })

        it('calculates progress correctly', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Mock total chapters count - 10
            mockFrom.mockReturnValueOnce(createChainableMock({ count: 10, error: null }))

            // Mock completed progress - 5 masterclass chapters
            mockFrom.mockReturnValueOnce(createChainableMock({
                data: [
                    { content_id: 'foundations/chapter-1' },
                    { content_id: 'foundations/chapter-2' },
                    { content_id: 'foundations/chapter-3' },
                    { content_id: 'masterclass/chapter-4' },
                    { content_id: 'masterclass/chapter-5' },
                ],
                error: null,
            }))

            const result = await getMasterclassCompletionStatus()

            expect(result.isComplete).toBe(false)
            expect(result.progress).toBe(50)
        })

        it('returns complete when all chapters done', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Mock total chapters - 3
            mockFrom.mockReturnValueOnce(createChainableMock({ count: 3, error: null }))

            // Mock completed - 3 masterclass chapters
            mockFrom.mockReturnValueOnce(createChainableMock({
                data: [
                    { content_id: 'foundations/ch-1' },
                    { content_id: 'foundations/ch-2' },
                    { content_id: 'masterclass/ch-3' },
                ],
                error: null,
            }))

            const result = await getMasterclassCompletionStatus()

            expect(result.isComplete).toBe(true)
            expect(result.progress).toBe(100)
        })

        it('handles database errors gracefully', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Mock total chapters - error
            mockFrom.mockReturnValueOnce(createChainableMock({ count: null, error: { message: 'DB Error' } }))

            const result = await getMasterclassCompletionStatus()

            expect(result.isComplete).toBe(false)
            expect(result.progress).toBe(0)
        })
    })
})
