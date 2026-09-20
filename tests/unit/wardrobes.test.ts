import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase admin client
const mockFrom = vi.fn()
// Returns the uploaded object by default; individual tests override it to
// simulate an upload that never landed.
const mockStorageList = vi.fn(async () => ({ data: [{ name: 'photo.jpg' }], error: null }))

const mockStorage = {
    from: vi.fn(() => ({
        upload: vi.fn(),
        list: mockStorageList,
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
        // clearAllMocks does not drain a mockReturnValueOnce queue, so an
        // unconsumed entry from a test that returned early would be handed to
        // the next one. Reset drains it.
        mockFrom.mockReset()
        mockStorageList.mockResolvedValue({ data: [{ name: 'photo.jpg' }], error: null })
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

            const result = await createWardrobeItem('valid-token', 'wardrobe/wardrobe-123/photo.jpg', 'tops', 'My note')

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

        // F10. A valid token used to admit ANY filePath, so a holder of
        // wardrobe A's token could create an item in A pointing at an object
        // under another wardrobe's folder, or another user's.
        describe('upload path boundary', () => {
            const validToken = () => {
                mockFrom.mockReturnValueOnce({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({
                        data: { id: 'wardrobe-123', owner_id: null },
                        error: null,
                    }),
                })
            }

            const insertSpy = () => {
                const insert = vi.fn().mockResolvedValue({ error: null })
                mockFrom.mockReturnValueOnce({ insert })
                return insert
            }

            it.each([
                ['another wardrobe', 'wardrobe/wardrobe-999/photo.jpg'],
                ['another user folder', 'some-other-user-id/photo.jpg'],
                ['a traversal', 'wardrobe/wardrobe-123/../wardrobe-999/photo.jpg'],
                ['an absolute path', '/etc/passwd'],
                ['the bare folder with no file', 'wardrobe/wardrobe-123/'],
                ['an empty path', ''],
            ])('refuses a path pointing at %s', async (_label, badPath) => {
                validToken()
                const insert = insertSpy()

                const result = await createWardrobeItem('valid-token', badPath, 'tops', '')

                expect(result.success).toBe(false)
                expect(insert).not.toHaveBeenCalled()
            })

            it('accepts the owner folder for an owned wardrobe', async () => {
                mockFrom.mockReturnValueOnce({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({
                        data: { id: 'wardrobe-123', owner_id: 'owner-456' },
                        error: null,
                    }),
                })
                const insert = insertSpy()

                const result = await createWardrobeItem('valid-token', 'owner-456/photo.jpg', 'tops', '')

                expect(result.success).toBe(true)
                expect(insert).toHaveBeenCalled()
            })

            it('refuses when the upload never actually landed', async () => {
                validToken()
                const insert = insertSpy()
                mockStorageList.mockResolvedValue({ data: [], error: null })

                const result = await createWardrobeItem('valid-token', 'wardrobe/wardrobe-123/photo.jpg', 'tops', '')

                // Otherwise an item row is created pointing at nothing, which
                // surfaces later as a broken image with no obvious cause.
                expect(result.success).toBe(false)
                expect(insert).not.toHaveBeenCalled()
            })
        })
    })
})
