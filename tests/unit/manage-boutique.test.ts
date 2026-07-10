import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChainableMock } from '../utils/supabase-mock'

// Service-role client used by getAdminBrands to read sensitive columns.
const mockAdminFrom = vi.fn()
vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

// RLS-respecting server client used by requireAdmin. Default: authenticated admin.
const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
        })),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getAdminBrands } from '@/app/actions/admin/manage-boutique'

describe('getAdminBrands', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
        mockRole = 'admin'
    })

    it('rejects unauthenticated callers before touching the service role', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } })

        const result = await getAdminBrands()

        expect(result.success).toBe(false)
        expect(result.error).toBe('Unauthorized')
        expect(mockAdminFrom).not.toHaveBeenCalled()
    })

    it('rejects authenticated non-admin callers', async () => {
        mockRole = 'user'

        const result = await getAdminBrands()

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
        expect(mockAdminFrom).not.toHaveBeenCalled()
    })

    it('returns full brand rows (including sensitive fields) for an admin', async () => {
        const brands = [{ id: '1', name: 'Zara', internal_notes: 'secret', commission_rate: 0.15 }]
        mockAdminFrom.mockReturnValue(createChainableMock({ data: brands, error: null }))

        const result = await getAdminBrands()

        expect(result.success).toBe(true)
        expect(result.brands).toHaveLength(1)
        expect(result.brands?.[0].internal_notes).toBe('secret')
    })
})
