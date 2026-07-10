import { describe, it, expect } from 'vitest'
import { safeNextPath } from '@/app/lib/safe-redirect'

describe('safeNextPath', () => {
    it('allows same-origin relative paths', () => {
        expect(safeNextPath('/vault')).toBe('/vault')
        expect(safeNextPath('/en/studio/wardrobe')).toBe('/en/studio/wardrobe')
        expect(safeNextPath('/vault?tab=1#top')).toBe('/vault?tab=1#top')
    })

    it('falls back for absolute URLs', () => {
        expect(safeNextPath('https://evil.com')).toBe('/en/vault')
        expect(safeNextPath('http://evil.com/path')).toBe('/en/vault')
    })

    it('falls back for protocol-relative and backslash tricks', () => {
        expect(safeNextPath('//evil.com')).toBe('/en/vault')
        expect(safeNextPath('/\\evil.com')).toBe('/en/vault')
        expect(safeNextPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com') // encoded, still same-origin path
    })

    it('falls back for non-path values', () => {
        expect(safeNextPath('evil.com')).toBe('/en/vault')
        expect(safeNextPath('javascript:alert(1)')).toBe('/en/vault')
        expect(safeNextPath(null)).toBe('/en/vault')
        expect(safeNextPath(undefined)).toBe('/en/vault')
        expect(safeNextPath('')).toBe('/en/vault')
    })

    it('honors a custom fallback', () => {
        expect(safeNextPath(null, '/vault')).toBe('/vault')
        expect(safeNextPath('//evil.com', '/vault')).toBe('/vault')
    })
})
