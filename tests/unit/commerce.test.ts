import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockFrom = vi.fn()
const mockAuth = { getUser: vi.fn() }
const mockAdminClient = { from: vi.fn() }

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => mockAdminClient),
}))

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
import { checkPurchase, getUserPurchases, syncStripePurchases } from '@/app/actions/commerce'
import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/utils/stripe'
import { grantAccessForProduct } from '@/app/lib/access-logic'

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

    describe('syncStripePurchases authorization', () => {
        const verifiedUser = { id: 'user-123', email: 'owner@example.invalid', email_confirmed_at: '2026-09-19' }
        const paidSession = {
            payment_status: 'paid', customer_email: verifiedUser.email,
            line_items: { data: [{ price: { product: 'prod-1' } }] },
        }

        it.each([null, { ...verifiedUser, email_confirmed_at: null }])('rejects an unverified identity before accessing Stripe or elevated credentials', async user => {
            mockAuth.getUser.mockResolvedValue({ data: { user } })
            const result = await syncStripePurchases()
            expect(result).toHaveProperty('error')
            expect(stripe.checkout.sessions.list).not.toHaveBeenCalled()
            expect(createAdminClient).not.toHaveBeenCalled()
        })

        it.each([
            { ...paidSession, payment_status: 'unpaid' },
            { ...paidSession, customer_email: 'someone@example.invalid' },
            { ...paidSession, client_reference_id: 'different-user' },
        ])('does not elevate for an unpaid or unrelated session', async session => {
            mockAuth.getUser.mockResolvedValue({ data: { user: verifiedUser } })
            vi.mocked(stripe.checkout.sessions.list).mockResolvedValue({ data: [session] } as never)
            await syncStripePurchases()
            expect(grantAccessForProduct).not.toHaveBeenCalled()
            expect(createAdminClient).not.toHaveBeenCalled()
        })

        it.each([
            paidSession,
            { ...paidSession, client_reference_id: verifiedUser.id, customer_email: 'billing@example.invalid' },
        ])('uses a trusted client only for a paid session belonging to the verified user', async session => {
            mockAuth.getUser.mockResolvedValue({ data: { user: verifiedUser } })
            vi.mocked(stripe.checkout.sessions.list).mockResolvedValue({ data: [session] } as never)
            const result = await syncStripePurchases()
            expect(grantAccessForProduct).toHaveBeenCalledWith(mockAdminClient, verifiedUser.id, 'prod-1')
            expect(result).toMatchObject({ success: true })
        })
    })

})
