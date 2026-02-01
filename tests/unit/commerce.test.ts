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

vi.mock('@/utils/stripe', () => ({
    stripe: {
        checkout: {
            sessions: {
                list: vi.fn(),
            },
        },
    },
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

vi.mock('@/app/lib/access-logic', () => ({
    grantAccessForProduct: vi.fn(() => true),
}))

// Import after mocks
import { checkPurchase, getUserPurchases, purchaseProduct } from '@/app/actions/commerce'

describe('Commerce Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('checkPurchase', () => {
        it('returns false when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await checkPurchase('product-123')

            expect(result).toBe(false)
        })

        it('returns true when purchase exists', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: 'purchase-1' }, error: null }),
            })

            const result = await checkPurchase('product-123')

            expect(result).toBe(true)
        })

        it('returns false when purchase does not exist', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
            })

            const result = await checkPurchase('product-999')

            expect(result).toBe(false)
        })
    })

    describe('getUserPurchases', () => {
        it('returns empty array when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await getUserPurchases()

            expect(result).toEqual([])
        })

        it('returns list of product IDs for authenticated user', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                then: vi.fn(),
            })

            // Mock the chain to return product IDs
            mockFrom.mockReturnValue({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        eq: vi.fn().mockResolvedValue({
                            data: [{ product_id: 'prod-1' }, { product_id: 'prod-2' }],
                            error: null,
                        }),
                    })),
                })),
            })

            const result = await getUserPurchases()

            expect(result).toEqual(['prod-1', 'prod-2'])
        })
    })

    describe('purchaseProduct', () => {
        it('returns error when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await purchaseProduct('product-123')

            expect(result.error).toBe('Not authenticated')
        })
    })
})
