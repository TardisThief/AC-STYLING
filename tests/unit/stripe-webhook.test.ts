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

const mockResolveUser = vi.fn()
const mockSetPasswordLink = vi.fn()
const mockSendEmail = vi.fn()

vi.mock('@/app/lib/guest-purchase', () => ({
    resolveOrCreateUserByEmail: (...args: unknown[]) => mockResolveUser(...args),
    generateSetPasswordLink: (...args: unknown[]) => mockSetPasswordLink(...args),
}))

vi.mock('@/lib/resend', () => ({
    sendEmail: (...args: unknown[]) => mockSendEmail(...args),
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
        mockResolveUser.mockResolvedValue({ userId: 'guest-user-1', created: true })
        mockSetPasswordLink.mockResolvedValue('https://link/set-password')
        mockSendEmail.mockResolvedValue({ success: true })
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

        // A guest checkout arrives with no user id by design. The old handler
        // logged it and returned 200, so Stripe considered the delivery done
        // and the purchase vanished. These pin the replacement behaviour.
        it('creates an account from the Stripe email when there is no userId', async () => {
            mockConstructEvent.mockReturnValue({
                type: 'checkout.session.completed',
                data: {
                    object: {
                        ...mockSession,
                        client_reference_id: null,
                        metadata: { flow: 'guest' },
                        customer_details: { email: 'guest@example.com', name: 'Ada L' },
                    }
                },
            })

            mockFrom.mockReturnValue(createChainableMock({ data: null, error: null }))

            const { POST } = await import('@/app/api/webhooks/stripe/route')
            const response = await POST(new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                body: JSON.stringify({}),
            }))

            expect(response.status).toBe(200)
            expect(mockResolveUser).toHaveBeenCalled()
            expect(mockResolveUser.mock.calls[0][1]).toBe('guest@example.com')
            // access must be granted to the resolved account
            expect(grantAccessForProduct).toHaveBeenCalled()
            expect((grantAccessForProduct as unknown as { mock: { calls: unknown[][] } })
                .mock.calls[0][1]).toBe('guest-user-1')
        })

        it('emails a set-password link only for a newly created account', async () => {
            mockConstructEvent.mockReturnValue({
                type: 'checkout.session.completed',
                data: {
                    object: {
                        ...mockSession,
                        client_reference_id: null,
                        metadata: { flow: 'guest' },
                        customer_details: { email: 'guest@example.com', name: 'Ada L' },
                    }
                },
            })
            mockFrom.mockReturnValue(createChainableMock({ data: null, error: null }))

            const { POST } = await import('@/app/api/webhooks/stripe/route')
            await POST(new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST', body: JSON.stringify({}),
            }))

            expect(mockSendEmail).toHaveBeenCalled()
            expect(mockSendEmail.mock.calls[0][0].to).toBe('guest@example.com')
        })

        it('does not email an existing customer who bought again', async () => {
            mockResolveUser.mockResolvedValue({ userId: 'existing-1', created: false })
            mockConstructEvent.mockReturnValue({
                type: 'checkout.session.completed',
                data: {
                    object: {
                        ...mockSession,
                        client_reference_id: null,
                        metadata: { flow: 'guest' },
                        customer_details: { email: 'repeat@example.com', name: 'Ada L' },
                    }
                },
            })
            mockFrom.mockReturnValue(createChainableMock({ data: null, error: null }))

            const { POST } = await import('@/app/api/webhooks/stripe/route')
            await POST(new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST', body: JSON.stringify({}),
            }))

            expect(mockSendEmail).not.toHaveBeenCalled()
            expect(grantAccessForProduct).toHaveBeenCalled()
        })

        it('fails with 500 when there is neither a userId nor an email, so Stripe retries', async () => {
            mockConstructEvent.mockReturnValue({
                type: 'checkout.session.completed',
                data: {
                    object: {
                        ...mockSession,
                        client_reference_id: null,
                        metadata: {},
                        customer_details: null,
                        customer_email: null,
                    }
                },
            })
            mockFrom.mockReturnValue(createChainableMock({ data: null, error: null }))

            const { POST } = await import('@/app/api/webhooks/stripe/route')
            const response = await POST(new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST', body: JSON.stringify({}),
            }))

            expect(response.status).toBe(500)
            expect(grantAccessForProduct).not.toHaveBeenCalled()
        })

        it('fails with 500 when the account cannot be created', async () => {
            mockResolveUser.mockResolvedValue(null)
            mockConstructEvent.mockReturnValue({
                type: 'checkout.session.completed',
                data: {
                    object: {
                        ...mockSession,
                        client_reference_id: null,
                        metadata: { flow: 'guest' },
                        customer_details: { email: 'broken@example.com' },
                    }
                },
            })
            mockFrom.mockReturnValue(createChainableMock({ data: null, error: null }))

            const { POST } = await import('@/app/api/webhooks/stripe/route')
            const response = await POST(new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST', body: JSON.stringify({}),
            }))

            expect(response.status).toBe(500)
            expect(grantAccessForProduct).not.toHaveBeenCalled()
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

        it('skips a duplicate event (already-processed event.id) without reprocessing', async () => {
            mockConstructEvent.mockReturnValue({
                id: 'evt_dup_123',
                type: 'checkout.session.completed',
                data: { object: mockSession },
            })

            // Idempotency gate upsert returns an empty array => the event_id row
            // already existed (duplicate delivery / retry).
            mockFrom.mockReturnValue(createChainableMock({ data: [], error: null }))

            const { POST } = await import('@/app/api/webhooks/stripe/route')

            const request = new Request('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                body: JSON.stringify({}),
            })

            const response = await POST(request)

            expect(response.status).toBe(200)
            expect(await response.text()).toBe('Already processed')
            expect(mockListLineItems).not.toHaveBeenCalled()
            expect(grantAccessForProduct).not.toHaveBeenCalled()
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
