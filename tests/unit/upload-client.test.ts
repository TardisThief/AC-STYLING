import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUploadFile = vi.fn()
vi.mock('@/app/actions/admin/upload-file', () => ({
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
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
    })

    it('returns the url and shows a success toast on success', async () => {
        mockUploadFile.mockResolvedValue({ success: true, url: 'https://cdn/x.jpg' })

        const url = await uploadAssetWithToast(makeFile(), 'Thumbnail uploaded')

        expect(url).toBe('https://cdn/x.jpg')
        expect(mockToastSuccess).toHaveBeenCalledWith('Thumbnail uploaded')
        expect(mockToastError).not.toHaveBeenCalled()
    })

    it('returns null and shows the action error on failure result', async () => {
        mockUploadFile.mockResolvedValue({ success: false, error: 'Unauthorized' })

        const url = await uploadAssetWithToast(makeFile(), 'Thumbnail uploaded')

        expect(url).toBeNull()
        expect(mockToastError).toHaveBeenCalledWith('Unauthorized')
    })

    it('returns null and shows a toast when the server action throws', async () => {
        mockUploadFile.mockRejectedValue(new Error('fetch failed'))

        const url = await uploadAssetWithToast(makeFile(), 'Thumbnail uploaded')

        expect(url).toBeNull()
        expect(mockToastError).toHaveBeenCalledTimes(1)
        expect(String(mockToastError.mock.calls[0][0])).toMatch(/upload failed/i)
    })

    it('rejects files over the size limit without calling the server', async () => {
        const url = await uploadAssetWithToast(makeFile(MAX_UPLOAD_BYTES + 1), 'Thumbnail uploaded')

        expect(url).toBeNull()
        expect(mockUploadFile).not.toHaveBeenCalled()
        expect(String(mockToastError.mock.calls[0][0])).toMatch(/15\s?MB/i)
    })
})
