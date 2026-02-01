import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkAccess } from '@/utils/access-control'

// Mock the server-side Supabase client
const mockRpc = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(() => ({
        rpc: mockRpc,
    })),
}))

describe('Access Control', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('checkAccess', () => {
        it('returns false for empty userId', async () => {
            const result = await checkAccess('', 'some-object-id')
            expect(result).toBe(false)
        })

        it('returns false for empty objectId', async () => {
            const result = await checkAccess('some-user-id', '')
            expect(result).toBe(false)
        })

        it('returns true when RPC returns true', async () => {
            mockRpc.mockResolvedValueOnce({ data: true, error: null })

            const result = await checkAccess('user-123', 'masterclass-456')

            expect(result).toBe(true)
            expect(mockRpc).toHaveBeenCalledWith('check_access', {
                check_user_id: 'user-123',
                check_object_id: 'masterclass-456',
            })
        })

        it('returns false when RPC returns false', async () => {
            mockRpc.mockResolvedValueOnce({ data: false, error: null })

            const result = await checkAccess('user-123', 'masterclass-456')

            expect(result).toBe(false)
        })

        it('returns false on RPC error', async () => {
            mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB Error' } })

            const result = await checkAccess('user-123', 'masterclass-456')

            expect(result).toBe(false)
        })
    })
})
