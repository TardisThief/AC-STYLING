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

            // Mock Masterclass & Chapter queries (returning null)
            const emptyQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            mockSupabase._mockFrom
                .mockReturnValueOnce(emptyQuery) // Masterclass
                .mockReturnValueOnce(emptyQuery) // Chapter
                .mockReturnValueOnce({ // Profile update
                    update: vi.fn(() => ({
                        eq: vi.fn().mockResolvedValue({ error: null }),
                    })),
                })

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_full_access_123',
                mockLog as any
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

            // Mock Masterclass & Chapter queries (returning null)
            const emptyQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            mockSupabase._mockFrom
                .mockReturnValueOnce(emptyQuery) // Masterclass
                .mockReturnValueOnce(emptyQuery) // Chapter
                .mockReturnValueOnce(offerQuery)
                .mockReturnValueOnce(profileUpdate)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_offer_456',
                mockLog as any
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

            // Mock Masterclass & Chapter queries (returning null)
            const emptyQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            mockSupabase._mockFrom
                .mockReturnValueOnce(emptyQuery) // Masterclass
                .mockReturnValueOnce(emptyQuery) // Chapter
                .mockReturnValueOnce(offerQuery)
                .mockReturnValueOnce(profileUpdate)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_course_pass',
                mockLog as any
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
                .mockReturnValueOnce(masterclassQuery)
                .mockReturnValueOnce(grantInsert)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_masterclass_789',
                mockLog as any
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

            // Mock Masterclass & Chapter queries (returning null)
            const emptyQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }

            mockSupabase._mockFrom
                .mockReturnValueOnce(emptyQuery) // Masterclass (not found)
                .mockReturnValueOnce(chapterQuery) // Chapter (found)
                .mockReturnValueOnce(grantInsert)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_chapter_101',
                mockLog as any
            )

            expect(result).toBe(true)
            expect(mockLog).toHaveBeenCalledWith('success', 'Granted Chapter: Color Theory')
        })
    })

    describe('No Match', () => {
        it('returns false when product matches nothing', async () => {
            // Mocking setup...
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
                .mockReturnValueOnce(masterclassQuery) // Correct order now: MC -> Chapter -> Offer (or MC -> Chapter -> (Env Check) -> Offer)
                // Wait, the logic is MC -> Chapter -> Env -> Offer.
                // In "No Match", access-logic checks MC (1), then Chapter (2), then Env check (not DB call), then Offer (3).
                // So expected mock calls are:
                // 1. Masterclass query
                // 2. Chapter query
                // 3. Offer query

                // Let's match the implemented order:
                .mockReturnValueOnce(masterclassQuery)
                .mockReturnValueOnce(chapterQuery)
                .mockReturnValueOnce(offerQuery)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                'prod_unknown',
                mockLog as any
            )

            expect(result).toBe(false)
        })
    })

    describe('Conflict Resolution (Regression Test)', () => {
        it('prioritizes Masterclass grant over Full Access when ID conflicts', async () => {
            const conflictProductId = 'prod_conflict_123'
            vi.stubEnv('STRIPE_FULL_ACCESS_PRODUCT_ID', conflictProductId)

            // Setup Mocks based on new priority:
            // 1. Masterclass query (FOUND) -> Grants access and returns true.
            const masterclassQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'mc_conflict', title: 'Conflict Masterclass' },
                    error: null
                }),
            }

            // Grant Insert
            const grantInsert = {
                insert: vi.fn().mockResolvedValue({ error: null }),
            }

            // Expect sequential calls:
            // 1. from('masterclasses')... -> returns masterclassQuery
            // 2. from('user_access_grants')... -> returns grantInsert

            mockSupabase._mockFrom
                .mockReturnValueOnce(masterclassQuery)
                .mockReturnValueOnce(grantInsert)

            const result = await grantAccessForProduct(
                mockSupabase as any,
                'user-123',
                conflictProductId,
                mockLog as any
            )

            expect(result).toBe(true)

            // Verify specific grant
            expect(mockLog).toHaveBeenCalledWith('success', 'Granted Masterclass: Conflict Masterclass')

            // Verify NO full access grant (generic log should not be called)
            expect(mockLog).not.toHaveBeenCalledWith('success', 'Granted Full Access (Env Match)')
        })
    })
})
