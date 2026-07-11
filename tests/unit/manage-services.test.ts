import { describe, it, expect, vi, beforeEach } from 'vitest'

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'
const mockWriteFrom = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
                }
            }
            return mockWriteFrom(table)
        }),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { upsertService, deleteService } from '@/app/actions/admin/manage-services'

function upsertChain() {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null })
    const select = vi.fn(() => ({ single }))
    const upsert = vi.fn(() => ({ select }))
    return { upsert }
}

beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRole = 'admin'
})

describe('upsertService', () => {
    it('rejects non-admin callers', async () => {
        mockRole = 'user'

        const result = await upsertService({ title: 'Styling Session' })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('requires a title and validates the type enum', async () => {
        const missing = await upsertService({ title: '' })
        expect(missing.error).toContain('Title is required')

        const badType = await upsertService({ title: 'Session', type: 'subscription' })
        expect(badType.success).toBe(false)
        expect(badType.error).toContain('Type must be session or retainer')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('strips unknown columns — mass-assignment regression guard', async () => {
        const chain = upsertChain()
        mockWriteFrom.mockReturnValue(chain)

        const result = await upsertService({
            title: 'Styling Session',
            type: 'session',
            active: true,
            unlocks_studio_access: true,
            recommendation_tags: ['color'],
            order_index: 3,
            evil_column: 'x',
        })

        expect(result.success).toBe(true)
        const row = chain.upsert.mock.calls[0][0]
        expect(row).not.toHaveProperty('evil_column')
        expect(row).toMatchObject({
            title: 'Styling Session',
            type: 'session',
            active: true,
            unlocks_studio_access: true,
            recommendation_tags: ['color'],
            order_index: 3,
        })
    })
})

describe('deleteService', () => {
    it('rejects a malformed id before deleting', async () => {
        const result = await deleteService('DROP TABLE services')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Service id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('deletes by a valid id', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom.mockReturnValue({ delete: vi.fn(() => ({ eq })) })

        const result = await deleteService(VALID_UUID)

        expect(result.success).toBe(true)
        expect(eq).toHaveBeenCalledWith('id', VALID_UUID)
    })
})
