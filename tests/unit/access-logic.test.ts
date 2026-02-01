import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create mock Supabase client
const createMockSupabase = () => {
    const mockFrom = vi.fn()

    return {
        from: mockFrom,
        _mockFrom: mockFrom,
    }
}

// Import after setting up mocks
import { grantAccessForProduct } from '@/app/lib/access-logic'

describe('Access Logic - grantAccessForProduct', () => {
    let mockSupabase: ReturnType<typeof createMockSupabase>
    let mockLog: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase = createMockSupabase()
        mockLog = vi.fn().mockResolvedValue(undefined)

        // Reset env
        vi.stubEnv('STRIPE_FULL_ACCESS_PRODUCT_ID', 'prod_full_access_123')
    })

    describe('Full Unlock via Environment Variable', () => {
        it('grants full unlock when product matches env var', async () => {
            const mockUpdate = vi.fn().mockReturnThis()
            const mockEq = vi.fn().mockResolvedValue({ error: null })

            mockSupabase._mockFrom.mockReturnValue({
                update: mockUpdate,
                eq: mockEq,
            })

            // Chain the calls properly
            mockSupabase._mockFrom.mockReturnValue({
                update: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
            })

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_full_access_123',
                mockLog
            )

            expect(result).toBe(true)
            expect(mockLog).toHaveBeenCalledWith('success', 'Granted Full Access (Env Match)')
        })
    })

    describe('Offers', () => {
        it('grants full access for full_access offer', async () => {
            // Mock offer lookup
            const offerQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'full_access' }, error: null }),
            }

            // Mock profile update
            const profileUpdate = {
                update: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
            }

            mockSupabase._mockFrom
                .mockReturnValueOnce(offerQuery)
                .mockReturnValueOnce(profileUpdate)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_offer_456',
                mockLog
            )

            expect(result).toBe(true)
        })

        it('grants course pass for course_pass offer', async () => {
            const offerQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: { slug: 'course_pass' }, error: null }),
            }

            const profileUpdate = {
                update: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
            }

            mockSupabase._mockFrom
                .mockReturnValueOnce(offerQuery)
                .mockReturnValueOnce(profileUpdate)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_course_pass',
                mockLog
            )

            expect(result).toBe(true)
            expect(mockLog).toHaveBeenCalledWith('success', 'Granted Course Pass (Offer)')
        })
    })

    describe('Masterclass Access', () => {
        it('creates access grant for masterclass purchase', async () => {
            // Mock offer lookup (not found)
            const offerQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            // Mock masterclass lookup (found)
            const masterclassQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mc-123', title: 'Style Foundations' },
                    error: null
                }),
            }

            // Mock grant insert
            const grantInsert = {
                insert: vi.fn().mockResolvedValue({ error: null }),
            }

            mockSupabase._mockFrom
                .mockReturnValueOnce(offerQuery)
                .mockReturnValueOnce(masterclassQuery)
                .mockReturnValueOnce(grantInsert)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_masterclass_789',
                mockLog
            )

            expect(result).toBe(true)
            expect(mockLog).toHaveBeenCalledWith('success', 'Granted Masterclass: Style Foundations')
        })
    })

    describe('Chapter Access', () => {
        it('creates access grant for chapter purchase', async () => {
            // Mock offer lookup (not found)
            const offerQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            // Mock masterclass lookup (not found)
            const masterclassQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            // Mock chapter lookup (found)
            const chapterQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'ch-456', title: 'Color Theory' },
                    error: null
                }),
            }

            // Mock grant insert
            const grantInsert = {
                insert: vi.fn().mockResolvedValue({ error: null }),
            }

            mockSupabase._mockFrom
                .mockReturnValueOnce(offerQuery)
                .mockReturnValueOnce(masterclassQuery)
                .mockReturnValueOnce(chapterQuery)
                .mockReturnValueOnce(grantInsert)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_chapter_101',
                mockLog
            )

            expect(result).toBe(true)
            expect(mockLog).toHaveBeenCalledWith('success', 'Granted Chapter: Color Theory')
        })
    })

    describe('No Match', () => {
        it('returns false when product matches nothing', async () => {
            // Mock offer lookup (not found)
            const offerQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            // Mock masterclass lookup (not found)
            const masterclassQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            // Mock chapter lookup (not found)
            const chapterQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            mockSupabase._mockFrom
                .mockReturnValueOnce(offerQuery)
                .mockReturnValueOnce(masterclassQuery)
                .mockReturnValueOnce(chapterQuery)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_unknown',
                mockLog
            )

            expect(result).toBe(false)
        })
    })
})
