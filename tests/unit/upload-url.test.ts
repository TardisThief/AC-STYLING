import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAdmin = vi.fn()
vi.mock('@/app/lib/auth-guards', () => ({
    requireAdmin: () => mockRequireAdmin(),
}))

import { createVaultUploadUrl } from '@/app/actions/admin/upload-file'

const mockCreateSignedUploadUrl = vi.fn()
const adminAuth = () => ({
    ok: true,
    user: { id: 'admin-1' },
    supabase: {
        storage: {
            from: () => ({ createSignedUploadUrl: mockCreateSignedUploadUrl }),
        },
    },
})

describe('createVaultUploadUrl', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRequireAdmin.mockResolvedValue(adminAuth())
        mockCreateSignedUploadUrl.mockImplementation((path: string) =>
            Promise.resolve({ data: { path, token: 'tok' }, error: null })
        )
    })

    it('rejects non-admin callers without touching storage', async () => {
        mockRequireAdmin.mockResolvedValue({ ok: false, error: 'Forbidden' })

        const res = await createVaultUploadUrl('photo.jpg')

        expect(res).toEqual({ success: false, error: 'Forbidden' })
        expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled()
    })

    it('returns a signed upload path and token for admins', async () => {
        const res = await createVaultUploadUrl('photo.jpg')

        expect(res.success).toBe(true)
        expect(res.token).toBe('tok')
        expect(res.path).toMatch(/^\d+-photo\.jpg$/)
    })

    it('strips path separators from the file name', async () => {
        const res = await createVaultUploadUrl('../../etc/passwd')

        expect(res.success).toBe(true)
        expect(res.path).not.toContain('/')
        expect(res.path).not.toContain('..')
    })

    it('surfaces storage errors as a readable failure', async () => {
        mockCreateSignedUploadUrl.mockResolvedValue({ data: null, error: { message: 'bucket not found' } })

        const res = await createVaultUploadUrl('photo.jpg')

        expect(res).toEqual({ success: false, error: 'bucket not found' })
    })
})
