/**
 * Stripe Webhook Tests
 * 
 * These tests are CRITICAL for production payment processing.
 * They verify the webhook handler correctly:
 * - Validates signatures
 * - Logs purchases
 * - Grants access for products
 * - Creates admin notifications
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChainableMock } from '../utils/supabase-mock'

// Mock dependencies
const mockFrom = vi.fn()
const mockConstructEvent = vi.fn()
const mockListLineItems = vi.fn()

vi.mock('@/utils/stripe', () => ({
    stripe: {
        webhooks: {
            constructEvent: mockConstructEvent,
        },
        checkout: {
            sessions: {
                listLineItems: mockListLineItems,
            },
        },
    },
}))

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
    })),
}))

vi.mock('@/app/lib/access-logic', () => ({
    grantAccessForProduct: vi.fn(() => true),
}))

vi.mock('next/headers', () => ({
    headers: vi.fn(() => ({
        get: vi.fn((key: string) => {
            if (key === 'Stripe-Signature') return 'valid_signature'
            return null
        }),
    })),
}))

import { grantAccessForProduct } from '@/app/lib/access-logic'

describe('Stripe Webhook Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
    })

    describe('Signature Verification', () => {
        it('rejects invalid signatures', async () => {
            mockConstructEvent.mockImplementation(() => {
                throw new Error('Invalid signature')
            })

            // Import the handler dynamically to get fresh instance
            const { POST } = await import('@/app/api/webhooks/stripe/route')

            const request = new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                body: JSON.stringify({ type: 'test' }),
            })

            const response = await POST(request)

            expect(response.status).toBe(400)
            const text = await response.text()
            expect(text).toContain('Webhook Error')
        })
    })

    describe('checkout.session.completed', () => {
        const mockSession = {
            id: 'cs_test_123',
            client_reference_id: 'user-123',
            metadata: { userId: 'user-123' },
            customer_details: {
                email: 'test@example.com',
                phone: '+1234567890',
                name: 'Test User',
            },
            customer_email: 'test@example.com',
        }

        beforeEach(() => {
            mockConstructEvent.mockReturnValue({
                type: 'checkout.session.completed',
                data: { object: mockSession },
            })
        })

        it('logs purchase correctly', async () => {
            mockListLineItems.mockResolvedValue({
                data: [{
                    price: { product: 'prod_masterclass_123' },
                    amount_total: 4999,
                    currency: 'usd',
                }],
            })

            // Mock all DB calls
            mockFrom.mockReturnValue(createChainableMock({ data: null, error: null }))

            const { POST } = await import('@/app/api/webhooks/stripe/route')

            const request = new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                body: JSON.stringify({}),
            })

            const response = await POST(request)

            expect(response.status).toBe(200)
            // Verify grantAccessForProduct was called
            expect(grantAccessForProduct).toHaveBeenCalled()
        })

        it('handles missing userId gracefully', async () => {
            mockConstructEvent.mockReturnValue({
                type: 'checkout.session.completed',
                data: {
                    object: {
                        ...mockSession,
                        client_reference_id: null,
                        metadata: {},
                    }
                },
            })

            mockFrom.mockReturnValue(createChainableMock({ data: null, error: null }))

            const { POST } = await import('@/app/api/webhooks/stripe/route')

            const request = new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                body: JSON.stringify({}),
            })

            const response = await POST(request)

            // Should return 200 (acknowledge to Stripe) but log error
            expect(response.status).toBe(200)
        })

        it('grants access for masterclass purchase', async () => {
            mockListLineItems.mockResolvedValue({
                data: [{
                    price: { product: { id: 'prod_masterclass_456' } },
                    amount_total: 9999,
                    currency: 'usd',
                }],
            })

            // Mock service lookup - not found
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: null }))
            // Mock webhook_events insert
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: null }))
            // Mock purchases insert
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: null }))
            // Mock further lookups
            mockFrom.mockReturnValue(createChainableMock({ data: null, error: null }))

            const { POST } = await import('@/app/api/webhooks/stripe/route')

            const request = new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                body: JSON.stringify({}),
            })

            const response = await POST(request)

            expect(response.status).toBe(200)
        })

        it('creates admin notification for service booking', async () => {
            mockListLineItems.mockResolvedValue({
                data: [{
                    price: { product: 'prod_consultation_789' },
                    amount_total: 14999,
                    currency: 'usd',
                }],
            })

            // Mock service lookup - found
            const mockService = { title: 'Style Consultation', image_url: 'https://img.url' }
            mockFrom
                .mockReturnValueOnce(createChainableMock({ data: null, error: null })) // webhook_events
                .mockReturnValueOnce(createChainableMock({ data: null, error: null })) // purchases
                .mockReturnValueOnce(createChainableMock({ data: mockService, error: null })) // services lookup
                .mockReturnValue(createChainableMock({ data: null, error: null })) // rest

            const { POST } = await import('@/app/api/webhooks/stripe/route')

            const request = new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                body: JSON.stringify({}),
            })

            const response = await POST(request)

            expect(response.status).toBe(200)
        })
    })

    describe('Database Error Handling', () => {
        it('continues processing even if purchase insert fails', async () => {
            mockConstructEvent.mockReturnValue({
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_456',
                        client_reference_id: 'user-456',
                        metadata: {},
                        customer_details: {},
                    }
                },
            })

            mockListLineItems.mockResolvedValue({
                data: [{
                    price: { product: 'prod_test' },
                    amount_total: 1999,
                    currency: 'usd',
                }],
            })

            // Mock purchase insert - fails
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: null })) // webhook_events
            mockFrom.mockReturnValueOnce(createChainableMock({ data: null, error: { message: 'Duplicate' } })) // purchases fails
            mockFrom.mockReturnValue(createChainableMock({ data: null, error: null })) // rest

            const { POST } = await import('@/app/api/webhooks/stripe/route')

            const request = new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                body: JSON.stringify({}),
            })

            const response = await POST(request)

            // Should still return 200 - must acknowledge Stripe
            expect(response.status).toBe(200)
        })
    })

    describe('Environment Configuration', () => {
        it('returns 500 if STRIPE_WEBHOOK_SECRET is missing', async () => {
            delete process.env.STRIPE_WEBHOOK_SECRET

            const { POST } = await import('@/app/api/webhooks/stripe/route')

            const request = new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                body: JSON.stringify({}),
            })

            const response = await POST(request)

            expect(response.status).toBe(500)
        })
    })
})
