import { describe, it, expect, vi, beforeEach } from 'vitest'

const MC_UUID = '123e4567-e89b-12d3-a456-426614174000'

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

import { createMasterclass, updateMasterclass, deleteMasterclass } from '@/app/actions/admin/manage-masterclasses'

function masterclassForm(overrides: Record<string, string> = {}) {
    const base: Record<string, string> = { title: 'Essence 101', orderIndex: '1' }
    const fd = new FormData()
    for (const [key, value] of Object.entries({ ...base, ...overrides })) fd.set(key, value)
    return fd
}

beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRole = 'admin'
})

describe('createMasterclass', () => {
    it('rejects non-admin callers', async () => {
        mockRole = 'user'

        const result = await createMasterclass(masterclassForm())

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('requires a title', async () => {
        const result = await createMasterclass(masterclassForm({ title: '' }))

        expect(result.success).toBe(false)
        expect(result.error).toContain('Title is required')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('inserts the mapped row and returns the created masterclass', async () => {
        const created = { id: MC_UUID, title: 'Essence 101' }
        const single = vi.fn().mockResolvedValue({ data: created, error: null })
        const select = vi.fn(() => ({ single }))
        const insert = vi.fn(() => ({ select }))
        mockWriteFrom.mockReturnValue({ insert })

        const result = await createMasterclass(masterclassForm({ subtitle: '  Sub  ' }))

        expect(result.success).toBe(true)
        expect(result.masterclass).toEqual(created)
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Essence 101',
            subtitle: 'Sub',
            order_index: 1,
        }))
    })
})

describe('updateMasterclass / deleteMasterclass', () => {
    it('updateMasterclass rejects a malformed id', async () => {
        const result = await updateMasterclass('nope', masterclassForm())

        expect(result.success).toBe(false)
        expect(result.error).toContain('Masterclass id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('deleteMasterclass deletes by a valid id', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom.mockReturnValue({ delete: vi.fn(() => ({ eq })) })

        const result = await deleteMasterclass(MC_UUID)

        expect(result.success).toBe(true)
        expect(eq).toHaveBeenCalledWith('id', MC_UUID)
    })
})
