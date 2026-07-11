import { describe, it, expect } from 'vitest'

import { parseVimeoId } from '@/app/lib/vimeo'

describe('parseVimeoId', () => {
    it('accepts a bare numeric id', () => {
        expect(parseVimeoId('1207933620')).toBe('1207933620')
    })

    it('trims surrounding whitespace', () => {
        expect(parseVimeoId('  1207933620  ')).toBe('1207933620')
    })

    it('extracts the id from a vimeo.com URL', () => {
        expect(parseVimeoId('https://vimeo.com/1207933620')).toBe('1207933620')
    })

    it('extracts the id from a URL with query params', () => {
        expect(parseVimeoId('https://vimeo.com/1207933620?share=copy')).toBe('1207933620')
    })

    it('extracts the id from a player embed URL', () => {
        expect(parseVimeoId('https://player.vimeo.com/video/1207933620')).toBe('1207933620')
    })

    it('extracts the id from an unlisted URL with a hash suffix', () => {
        expect(parseVimeoId('https://vimeo.com/1207933620/abcdef1234')).toBe('1207933620')
    })

    it('returns null for placeholder values', () => {
        expect(parseVimeoId('https://vimeo.com/pending_m1')).toBeNull()
    })

    it('returns null for empty, null, and undefined input', () => {
        expect(parseVimeoId('')).toBeNull()
        expect(parseVimeoId(null)).toBeNull()
        expect(parseVimeoId(undefined)).toBeNull()
    })

    it('returns null for arbitrary non-vimeo text', () => {
        expect(parseVimeoId('not a video')).toBeNull()
        expect(parseVimeoId('https://youtube.com/watch?v=123')).toBeNull()
    })
})
