/**
 * sendEmail must report what Resend actually did.
 *
 * The Resend SDK does not throw when it refuses a message — a bad address, an
 * unverified domain, a rate limit, a revoked key. It resolves with
 * `{ data: null, error }`. sendEmail only caught throws, so every refusal came
 * back `{ success: true }`: signup said "check your inbox" for a message that
 * was never accepted, and the webhook logged "Welcome email sent" to a buyer
 * who got nothing. Found by the 2026-09-25 external assessment (MAIL-001).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// tests/setup.ts replaces @/lib/resend wholesale; this file tests the real one,
// so it mocks the SDK underneath it instead.
vi.unmock('@/lib/resend')

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('resend', () => ({
    Resend: class {
        emails = { send }
    },
}))

import { sendEmail } from '@/lib/resend'

const message = { to: 'buyer@example.invalid', subject: 'Hi', html: '<p>Hi</p>' }

describe('sendEmail result', () => {
    beforeEach(() => {
        send.mockReset()
        process.env.RESEND_API_KEY = 're_test'
    })

    it('reports a refusal Resend resolves with as a failure', async () => {
        send.mockResolvedValue({
            data: null,
            error: { name: 'validation_error', message: 'The to address is invalid.' },
        })

        const result = await sendEmail(message)

        expect(result.success).toBe(false)
        expect(String(result.error)).toContain('The to address is invalid.')
    })

    it('reports a thrown network failure as a failure', async () => {
        send.mockRejectedValue(new Error('fetch failed'))

        const result = await sendEmail(message)

        expect(result.success).toBe(false)
    })

    it('reports an accepted message as sent', async () => {
        send.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

        const result = await sendEmail(message)

        expect(result.success).toBe(true)
    })
})
