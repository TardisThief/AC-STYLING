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

import { upsertOffer } from '@/app/actions/admin/manage-offers'

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

describe('upsertOffer', () => {
    it('rejects unauthenticated and non-admin callers', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } })
        expect((await upsertOffer({ slug: 's', title: 't' })).error).toBe('Unauthorized')

        mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
        mockRole = 'user'
        expect((await upsertOffer({ slug: 's', title: 't' })).error).toBe('Forbidden')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('requires slug and title with readable errors', async () => {
        const result = await upsertOffer({ slug: '', title: '' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Slug is required')
        expect(result.error).toContain('Title is required')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('strips unknown columns — mass-assignment regression guard', async () => {
        const chain = upsertChain()
        mockWriteFrom.mockReturnValue(chain)

        const result = await upsertOffer({
            slug: 'full_access',
            title: 'Full Access',
            active: true,
            // tampered keys that must never reach the DB write:
            created_at: '1999-01-01T00:00:00Z',
            granted_by: 'attacker',
        })

        expect(result.success).toBe(true)
        const row = chain.upsert.mock.calls[0][0]
        expect(row).not.toHaveProperty('created_at')
        expect(row).not.toHaveProperty('granted_by')
        expect(row).toMatchObject({ slug: 'full_access', title: 'Full Access', active: true })
    })

    it('omits absent optional columns so the upsert cannot null them out', async () => {
        const chain = upsertChain()
        mockWriteFrom.mockReturnValue(chain)

        await upsertOffer({ id: VALID_UUID, slug: 'course_pass', title: 'Course Pass' })

        const row = chain.upsert.mock.calls[0][0]
        expect(row).not.toHaveProperty('title_es')
        expect(row).not.toHaveProperty('description_es')
        expect(row.id).toBe(VALID_UUID)
    })

    it('drops an empty-string id so the insert path uses the DB default', async () => {
        const chain = upsertChain()
        mockWriteFrom.mockReturnValue(chain)

        await upsertOffer({ id: '', slug: 'full_access', title: 'Full Access' })

        expect(chain.upsert.mock.calls[0][0]).not.toHaveProperty('id')
    })
})
