/**
 * Account deletion (F11).
 *
 * Measured on the live database before migration 15: `DELETE FROM auth.users`
 * for a user with course progress failed outright on
 * `user_progress_user_id_fkey`, so "Delete my account" did not work for anyone
 * who had watched anything. And `public.profiles` had no foreign key to
 * `auth.users` at all, so even a successful delete would have left the profile
 * and everything cascading from it in place.
 *
 * The constraint half of that is enforced by the database and was verified
 * against it when migration 15 was applied — a user with 9 progress rows and
 * 10 essence responses became deletable, and everything went with them.
 *
 * These cover the half a constraint cannot: storage objects, which no cascade
 * reaches, and reporting a partial failure instead of claiming a clean sweep.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockSignOut = vi.fn()
const mockDeleteUser = vi.fn()
const mockList = vi.fn()
const mockRemove = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser, signOut: mockSignOut },
    })),
}))

vi.mock('@/utils/supabase/admin-client', () => ({
    createSupabaseAdminClient: vi.fn(() => ({
        auth: { admin: { deleteUser: mockDeleteUser } },
        // No wardrobes: moving wardrobe photos is covered against the live
        // schema in tests/integration/wardrobe-outlives-client.test.ts.
        from: () => ({
            select: () => ({ eq: async () => ({ data: [], error: null }) }),
            delete: () => ({ eq: () => ({ is: async () => ({ error: null }) }) }),
        }),
        storage: { from: vi.fn(() => ({ list: mockList, remove: mockRemove })) },
    })),
}))

import { deleteAccount } from '@/app/actions/vault/account'

describe('deleteAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
        mockSignOut.mockResolvedValue({})
        mockDeleteUser.mockResolvedValue({ error: null })
        mockList.mockResolvedValue({ data: [], error: null })
        mockRemove.mockResolvedValue({ error: null })
    })

    it('refuses when nobody is signed in', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } })

        await expect(deleteAccount()).resolves.toEqual({ success: false, error: 'Not authenticated' })
        expect(mockDeleteUser).not.toHaveBeenCalled()
    })

    it('removes the uploaded images before deleting the account', async () => {
        // Once the auth user is gone there is no reliable handle on which
        // objects were theirs, so the order matters.
        mockList.mockResolvedValue({ data: [{ name: 'a.jpg' }, { name: 'b.jpg' }], error: null })

        await deleteAccount()

        expect(mockRemove).toHaveBeenCalledWith(['user-1/a.jpg', 'user-1/b.jpg'])
        expect(mockRemove.mock.invocationCallOrder[0])
            .toBeLessThan(mockDeleteUser.mock.invocationCallOrder[0])
    })

    it('scopes the image listing to the caller and nobody else', async () => {
        await deleteAccount()
        expect(mockList).toHaveBeenCalledWith('user-1', expect.anything())
    })

    it('still closes the account when the images cannot be removed', async () => {
        mockRemove.mockResolvedValue({ error: { message: 'storage unavailable' } })
        mockList.mockResolvedValue({ data: [{ name: 'a.jpg' }], error: null })

        const result = await deleteAccount()

        // Stopping halfway would leave the account open, which is worse.
        expect(mockDeleteUser).toHaveBeenCalled()
        expect(result.success).toBe(true)
        // ...but it must not be reported as a clean deletion.
        expect(result.storageCleanupFailed).toBe(true)
    })

    it('reports a clean deletion when everything succeeded', async () => {
        const result = await deleteAccount()

        expect(result).toMatchObject({ success: true, storageCleanupFailed: false })
        expect(mockSignOut).toHaveBeenCalled()
    })

    it('surfaces a failure to delete the auth user rather than claiming success', async () => {
        mockDeleteUser.mockResolvedValue({ error: { message: 'still referenced' } })

        const result = await deleteAccount()

        expect(result.success).toBe(false)
        expect(result.error).toContain('still referenced')
        expect(mockSignOut).not.toHaveBeenCalled()
    })

    it('does not fail the deletion when the image listing itself errors', async () => {
        mockList.mockResolvedValue({ data: null, error: { message: 'bucket missing' } })

        const result = await deleteAccount()

        expect(result.success).toBe(true)
        expect(result.storageCleanupFailed).toBe(true)
        expect(mockRemove).not.toHaveBeenCalled()
    })
})
