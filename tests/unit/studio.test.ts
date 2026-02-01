import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase - need to use dynamic import mock for studio.ts
const mockFrom = vi.fn()
const mockAuth = { getUser: vi.fn() }
const mockStorage = {
    from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.url/image.jpg' } })),
    })),
}

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: mockAuth,
        from: mockFrom,
        storage: mockStorage,
    })),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

// Import after mocks
import {
    updateProfileStatus,
    permanentDeleteProfile,
    deleteWardrobeItem,
    getStudioInboxItems,
    processWardrobeItem,
} from '@/app/actions/studio'

describe('Studio Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('updateProfileStatus', () => {
        it('returns error when user not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await updateProfileStatus('profile-123', 'active')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Unauthorized')
        })

        it('returns error when user is not admin', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null }),
            })

            const result = await updateProfileStatus('profile-123', 'active')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Unauthorized')
        })

        it('updates profile status when admin', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'admin-123' } } })

            // Mock admin check
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            })

            // Mock update
            mockFrom.mockReturnValueOnce({
                update: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
            })

            const result = await updateProfileStatus('profile-123', 'archived')

            expect(result.success).toBe(true)
        })
    })

    describe('permanentDeleteProfile', () => {
        it('returns error when not admin', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null }),
            })

            const result = await permanentDeleteProfile('profile-123')

            expect(result.success).toBe(false)
        })

        it('deletes profile when admin', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'admin-123' } } })

            // Admin check
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            })

            // Delete
            mockFrom.mockReturnValueOnce({
                delete: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
            })

            const result = await permanentDeleteProfile('profile-123')

            expect(result.success).toBe(true)
        })
    })

    describe('deleteWardrobeItem', () => {
        it('returns error when not authenticated', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: null } })

            const result = await deleteWardrobeItem('item-123')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Unauthorized')
        })

        it('returns error when item not found', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            })

            const result = await deleteWardrobeItem('nonexistent-item')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Item not found')
        })

        it('allows owner to delete their item', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Item fetch - owned by user
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { user_id: 'user-123', image_url: 'https://storage.test/studio-wardrobe/user-123/photo.jpg' },
                    error: null,
                }),
            })

            // Delete
            mockFrom.mockReturnValueOnce({
                delete: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
            })

            const result = await deleteWardrobeItem('item-123')

            expect(result.success).toBe(true)
        })

        it('allows admin to delete any item', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'admin-123' } } })

            // Item fetch - owned by different user
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { user_id: 'other-user-456', image_url: 'https://storage.test/photo.jpg' },
                    error: null,
                }),
            })

            // Admin check
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            })

            // Delete
            mockFrom.mockReturnValueOnce({
                delete: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
            })

            const result = await deleteWardrobeItem('item-123')

            expect(result.success).toBe(true)
        })

        it('denies non-owner non-admin from deleting', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            // Item owned by different user
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { user_id: 'other-user-456', image_url: 'https://storage.test/photo.jpg' },
                    error: null,
                }),
            })

            // Profile check - not admin
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null }),
            })

            const result = await deleteWardrobeItem('item-123')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Unauthorized')
        })
    })

    describe('getStudioInboxItems', () => {
        it('returns error when not admin', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null }),
            })

            const result = await getStudioInboxItems()

            expect(result.success).toBe(false)
        })

        it('returns inbox items when admin', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'admin-123' } } })

            // Admin check
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            })

            // Inbox fetch
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({
                    data: [{ id: 'item-1', status: 'inbox' }],
                    error: null,
                }),
            })

            const result = await getStudioInboxItems()

            expect(result.success).toBe(true)
            expect(result.data).toHaveLength(1)
        })
    })

    describe('processWardrobeItem', () => {
        it('returns error when not admin', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null }),
            })

            const result = await processWardrobeItem('item-123', 'keep')

            expect(result.success).toBe(false)
        })

        it('updates item status with metadata when admin', async () => {
            mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'admin-123' } } })

            // Admin check
            mockFrom.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            })

            // Update
            mockFrom.mockReturnValueOnce({
                update: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                })),
            })

            const result = await processWardrobeItem('item-123', 'keep', {
                tags: ['casual', 'summer'],
                brand: 'Zara',
                notes: 'Client favorite',
            })

            expect(result.success).toBe(true)
        })
    })
})
