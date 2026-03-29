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
                create: vi.fn(),
            },
        },
    },
}))

vi.mock('next/headers', () => ({
    headers: vi.fn(() => ({
        get: vi.fn(() => 'http://localhost:3000'),
    })),
}))

vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}))

// Import after mocks
import { createCheckoutSession } from '@/app/actions/stripe'
import { stripe } from '@/utils/stripe'

describe('Stripe Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('createCheckoutSession', () => {
        it('returns error when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await createCheckoutSession('price_123', '/vault')

            expect(result.error).toBe('User must be logged in')
        })

        it('returns error when user is anonymous', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123', is_anonymous: true } } })

            const result = await createCheckoutSession('price_123', '/vault')

            expect(result.error).toBe('User must be logged in')
        })

        it('returns error when price ID missing', async () => {
            mockAuth.getUser.mockResolvedValue({
                data: { user: { id: 'user-123', email: 'test@example.com', is_anonymous: false } },
            })

            const result = await createCheckoutSession('', '/vault')

            expect(result.error).toBe('Price ID is missing')
        })

        it('creates checkout session and returns URL', async () => {
            mockAuth.getUser.mockResolvedValue({
                data: { user: { id: 'user-123', email: 'test@example.com', is_anonymous: false } },
            })

            const mockSession = { url: 'https://checkout.stripe.com/session/xxx' }
                ; (stripe.checkout.sessions.create as any).mockResolvedValue(mockSession)

            const result = await createCheckoutSession('price_abc123', '/vault/courses')

            expect(result.url).toBe(mockSession.url)
            expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    mode: 'payment',
                    client_reference_id: 'user-123',
                    customer_email: 'test@example.com',
                })
            )
        })

        it('handles Stripe API errors', async () => {
            mockAuth.getUser.mockResolvedValue({
                data: { user: { id: 'user-123', email: 'test@example.com', is_anonymous: false } },
            })

                ; (stripe.checkout.sessions.create as any).mockRejectedValue(new Error('Stripe API Error'))

            const result = await createCheckoutSession('price_abc123', '/vault')

            expect(result.error).toBe('Stripe API Error')
        })

        it('works without email (optional field)', async () => {
            mockAuth.getUser.mockResolvedValue({
                data: { user: { id: 'user-123', email: null, is_anonymous: false } },
            })

            const mockSession = { url: 'https://checkout.stripe.com/session/xxx' }
                ; (stripe.checkout.sessions.create as any).mockResolvedValue(mockSession)

            const result = await createCheckoutSession('price_abc123', '/vault')

            // Should succeed without customer_email
            expect(result.url).toBeDefined()
        })
    })
})
