import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase admin client
const mockFrom = vi.fn()
const mockStorage = {
    from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.url/image.jpg' } })),
        createSignedUploadUrl: vi.fn(() => ({ data: { signedUrl: 'https://signed.url' }, error: null })),
    })),
}

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
        storage: mockStorage,
    })),
}))

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: vi.fn() },
        from: mockFrom,
    })),
}))

// Import after mocks
import { getWardrobeByToken, getSignedUploadUrl, createWardrobeItem } from '@/app/actions/wardrobes'

describe('Wardrobes Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getWardrobeByToken', () => {
        it('returns wardrobe for valid token', async () => {
            const mockWardrobe = {
                id: 'wardrobe-123',
                title: 'Test Wardrobe',
                upload_token: 'valid-token',
                status: 'active',
            }

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockWardrobe, error: null }),
            })

            const result = await getWardrobeByToken('valid-token')

            expect(result.success).toBe(true)
            expect(result.wardrobe?.id).toBe('wardrobe-123')
        })

        it('returns error for invalid token', async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            })

            const result = await getWardrobeByToken('invalid-token')

            expect(result.success).toBe(false)
            expect(result.error).toContain('Invalid')
        })
    })

    describe('getSignedUploadUrl', () => {
        it('returns signed URL for valid token', async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { id: 'wardrobe-123', owner_id: 'owner-456' },
                    error: null,
                }),
            })

            const result = await getSignedUploadUrl('valid-token', 'photo.jpg')

            expect(result.success).toBe(true)
            expect(result.signedUrl).toBeDefined()
            expect(result.filePath).toContain('wardrobe/')
        })

        it('returns error for invalid token', async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            })

            const result = await getSignedUploadUrl('invalid-token', 'photo.jpg')

            expect(result.success).toBe(false)
        })
    })

    describe('createWardrobeItem', () => {
        it('creates item for valid token', async () => {
            // Mock token validation
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { id: 'wardrobe-123', owner_id: 'owner-456' },
                    error: null,
                }),
            })

            // Mock insert
            mockFrom.mockReturnValueOnce({
                insert: vi.fn().mockResolvedValue({ error: null }),
            })

            const result = await createWardrobeItem('valid-token', 'wardrobe/123/photo.jpg', 'tops', 'My note')

            expect(result.success).toBe(true)
        })

        it('fails for invalid token', async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            })

            const result = await createWardrobeItem('invalid-token', 'path', 'category', 'note')

            expect(result.success).toBe(false)
        })
    })
})
