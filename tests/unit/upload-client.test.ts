import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateVaultUploadUrl = vi.fn()
vi.mock('@/app/actions/admin/upload-file', () => ({
    createVaultUploadUrl: (...args: unknown[]) => mockCreateVaultUploadUrl(...args),
}))

const mockUploadToSignedUrl = vi.fn()
const mockGetPublicUrl = vi.fn()
vi.mock('@/utils/supabase/client', () => ({
    createClient: () => ({
        storage: {
            from: () => ({
                uploadToSignedUrl: mockUploadToSignedUrl,
                getPublicUrl: mockGetPublicUrl,
            }),
        },
    }),
}))

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => mockToastSuccess(...args),
        error: (...args: unknown[]) => mockToastError(...args),
    },
}))

import { uploadAssetWithToast, MAX_UPLOAD_BYTES } from '@/app/lib/upload-client'

const makeFile = (size = 1024, name = 'photo.jpg') => {
    const file = new File(['x'], name, { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: size })
    return file
}

describe('uploadAssetWithToast', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCreateVaultUploadUrl.mockResolvedValue({ success: true, path: '123-photo.jpg', token: 'tok' })
        mockUploadToSignedUrl.mockResolvedValue({ data: { path: '123-photo.jpg' }, error: null })
        mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/123-photo.jpg' } })
    })

    it('uploads directly to storage via a signed URL and returns the public url', async () => {
        const url = await uploadAssetWithToast(makeFile(), 'Thumbnail uploaded')

        expect(mockCreateVaultUploadUrl).toHaveBeenCalledWith('photo.jpg')
        expect(mockUploadToSignedUrl).toHaveBeenCalledWith('123-photo.jpg', 'tok', expect.any(File))
        expect(url).toBe('https://cdn/123-photo.jpg')
        expect(mockToastSuccess).toHaveBeenCalledWith('Thumbnail uploaded')
        expect(mockToastError).not.toHaveBeenCalled()
    })

    it('returns null and shows the action error when authorization fails', async () => {
        mockCreateVaultUploadUrl.mockResolvedValue({ success: false, error: 'Forbidden' })

        const url = await uploadAssetWithToast(makeFile(), 'Thumbnail uploaded')

        expect(url).toBeNull()
        expect(mockUploadToSignedUrl).not.toHaveBeenCalled()
        expect(mockToastError).toHaveBeenCalledWith('Forbidden')
    })

    it('returns null and shows the storage error when the direct upload fails', async () => {
        mockUploadToSignedUrl.mockResolvedValue({ data: null, error: { message: 'quota exceeded' } })

        const url = await uploadAssetWithToast(makeFile(), 'Thumbnail uploaded')

        expect(url).toBeNull()
        expect(mockToastError).toHaveBeenCalledWith('quota exceeded')
    })

    it('returns null and shows a toast when the flow throws', async () => {
        mockCreateVaultUploadUrl.mockRejectedValue(new Error('fetch failed'))

        const url = await uploadAssetWithToast(makeFile(), 'Thumbnail uploaded')

        expect(url).toBeNull()
        expect(mockToastError).toHaveBeenCalledTimes(1)
        expect(String(mockToastError.mock.calls[0][0])).toMatch(/upload failed/i)
    })

    it('rejects files over the size limit without calling the server', async () => {
        const url = await uploadAssetWithToast(makeFile(MAX_UPLOAD_BYTES + 1), 'Thumbnail uploaded')

        expect(url).toBeNull()
        expect(mockCreateVaultUploadUrl).not.toHaveBeenCalled()
        expect(String(mockToastError.mock.calls[0][0])).toMatch(/15\s?MB/i)
    })
})
