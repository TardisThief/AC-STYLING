import { describe, it, expect } from 'vitest'
import { wardrobeStorageFolder, wardrobeUploadPath } from '@/lib/wardrobe-paths'

describe('wardrobeStorageFolder', () => {
    it('uses the owner folder when an owner exists', () => {
        expect(wardrobeStorageFolder('user-1', 'ward-1')).toBe('user-1')
    })

    it('falls back to the wardrobe/ prefix when unowned', () => {
        expect(wardrobeStorageFolder(null, 'ward-1')).toBe('wardrobe/ward-1')
    })
})

describe('wardrobeUploadPath', () => {
    it('builds <folder>/<timestamp>-<name>', () => {
        expect(wardrobeUploadPath('user-1', 'ward-1', 'photo.jpg', 1770000000000))
            .toBe('user-1/1770000000000-photo.jpg')
    })

    it('strips path separators and traversal from the file name', () => {
        expect(wardrobeUploadPath(null, 'ward-1', '../a/b.jpg', 1770000000000))
            .toBe('wardrobe/ward-1/1770000000000-_a_b.jpg')
    })

    it('defaults an empty name', () => {
        expect(wardrobeUploadPath('user-1', 'ward-1', '', 1770000000000))
            .toBe('user-1/1770000000000-upload')
    })
})
