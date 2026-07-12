import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockCreateSignedUploadUrl = vi.fn()
const mockInsert = vi.fn()
const mockGetPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://test.url/x.jpg' } }))

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
        storage: {
            from: vi.fn(() => ({
                createSignedUploadUrl: mockCreateSignedUploadUrl,
                getPublicUrl: mockGetPublicUrl,
            })),
        },
    })),
}))

import { createIntakeUploadUrl, createIntakeItem } from '@/app/actions/intake'

const validTokenLookup = () => mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'profile-1' }, error: null }),
})

describe('createIntakeUploadUrl', () => {
    beforeEach(() => vi.clearAllMocks())

    it('mints a signed upload URL under wardrobe/<profileId>/', async () => {
        validTokenLookup()
        mockCreateSignedUploadUrl.mockResolvedValue({
            data: { path: 'wardrobe/profile-1/123-a.jpg', token: 'tok', signedUrl: 'https://x' },
            error: null,
        })

        const res = await createIntakeUploadUrl('tok-1', 'a.jpg')

        expect(res.success).toBe(true)
        expect(mockCreateSignedUploadUrl.mock.calls[0][0]).toMatch(/^wardrobe\/profile-1\/\d+-a\.jpg$/)
    })

    it('rejects an invalid token without touching storage', async () => {
        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } }),
        })

        const res = await createIntakeUploadUrl('bad', 'a.jpg')

        expect(res.success).toBe(false)
        expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled()
    })

    it('rejects disallowed file extensions', async () => {
        const res = await createIntakeUploadUrl('tok-1', 'malware.exe')
        expect(res.success).toBe(false)
        expect(res.error).toMatch(/JPG, PNG, WEBP/i)
    })
})

describe('createIntakeItem', () => {
    beforeEach(() => vi.clearAllMocks())

    it('inserts an inbox wardrobe_items row for the invite profile', async () => {
        const single = vi.fn().mockResolvedValue({ data: { id: '2b7e1c1e-0000-4000-8000-000000000000' }, error: null })
        mockInsert.mockResolvedValue({ error: null })
        mockFrom.mockImplementation((table: string) => table === 'profiles'
            ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
            : { insert: mockInsert })

        const res = await createIntakeItem('tok-1', 'wardrobe/2b7e1c1e-0000-4000-8000-000000000000/1-a.jpg', 'my note')

        expect(res.success).toBe(true)
        expect(mockInsert.mock.calls[0][0]).toMatchObject({
            user_id: '2b7e1c1e-0000-4000-8000-000000000000',
            status: 'inbox',
            client_note: 'my note',
        })
    })

    it('rejects a path outside wardrobe/<uuid>/', async () => {
        const res = await createIntakeItem('tok-1', 'someone-else/1-a.jpg', '')
        expect(res.success).toBe(false)
    })

    it('rejects a wardrobe/ path for a different profile', async () => {
        const single = vi.fn().mockResolvedValue({ data: { id: '2b7e1c1e-0000-4000-8000-000000000000' }, error: null })
        mockFrom.mockImplementation((table: string) => table === 'profiles'
            ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
            : { insert: mockInsert })

        const res = await createIntakeItem('tok-1', 'wardrobe/99999999-0000-4000-8000-000000000000/1-a.jpg', '')

        expect(res.success).toBe(false)
        expect(mockInsert).not.toHaveBeenCalled()
    })
})
