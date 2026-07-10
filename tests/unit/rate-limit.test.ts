import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({ rpc: mockRpc })),
}))

import { checkEmailRateLimit } from '@/app/lib/rate-limit'

describe('checkEmailRateLimit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('allows when both email and IP are under the limit', async () => {
        mockRpc.mockResolvedValue({ data: true, error: null })

        const result = await checkEmailRateLimit('User@Example.com', '1.2.3.4')

        expect(result.allowed).toBe(true)
        // email key first, then ip key
        expect(mockRpc).toHaveBeenNthCalledWith(1, 'check_rate_limit', {
            p_key: 'email:user@example.com',
            p_max: 3,
            p_window: '900 seconds',
        })
        expect(mockRpc).toHaveBeenNthCalledWith(2, 'check_rate_limit', {
            p_key: 'ip:1.2.3.4',
            p_max: 10,
            p_window: '3600 seconds',
        })
    })

    it('blocks when the email limit trips (retryAfter = email window)', async () => {
        mockRpc.mockResolvedValue({ data: true, error: null })
        mockRpc.mockResolvedValueOnce({ data: false, error: null }) // email call

        const result = await checkEmailRateLimit('a@b.com', '1.2.3.4')

        expect(result.allowed).toBe(false)
        expect(result.retryAfterSeconds).toBe(900)
    })

    it('blocks when the IP limit trips (retryAfter = IP window)', async () => {
        mockRpc
            .mockResolvedValueOnce({ data: true, error: null })  // email
            .mockResolvedValueOnce({ data: false, error: null }) // ip

        const result = await checkEmailRateLimit('a@b.com', '9.9.9.9')

        expect(result.allowed).toBe(false)
        expect(result.retryAfterSeconds).toBe(3600)
    })

    it('fails open (allows) when the RPC returns an error', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

        const result = await checkEmailRateLimit('a@b.com', '1.2.3.4')

        expect(result.allowed).toBe(true)
    })

    it('fails open (allows) when the RPC throws', async () => {
        mockRpc.mockRejectedValue(new Error('db down'))

        const result = await checkEmailRateLimit('a@b.com', '1.2.3.4')

        expect(result.allowed).toBe(true)
    })

    it('skips the IP check when no IP is available', async () => {
        mockRpc.mockResolvedValue({ data: true, error: null })

        const result = await checkEmailRateLimit('a@b.com', null)

        expect(result.allowed).toBe(true)
        expect(mockRpc).toHaveBeenCalledTimes(1)
        expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
            p_key: 'email:a@b.com',
            p_max: 3,
            p_window: '900 seconds',
        })
    })
})
