import { describe, it, expect, vi } from 'vitest'
import { deriveStoragePath, signWardrobeItems } from '@/lib/wardrobe-images'

describe('deriveStoragePath', () => {
    it('extracts the path from a public studio-wardrobe URL', () => {
        expect(
            deriveStoragePath('https://proj.supabase.co/storage/v1/object/public/studio-wardrobe/user-1/photo.jpg')
        ).toBe('user-1/photo.jpg')
    })

    it('url-decodes encoded path segments', () => {
        expect(
            deriveStoragePath('https://proj.supabase.co/storage/v1/object/public/studio-wardrobe/user-1/a%20b.jpg')
        ).toBe('user-1/a b.jpg')
    })

    it('accepts a bare relative path', () => {
        expect(deriveStoragePath('user-1/photo.jpg')).toBe('user-1/photo.jpg')
        expect(deriveStoragePath('/user-1/photo.jpg')).toBe('user-1/photo.jpg')
    })

    it('returns null for foreign URLs and empty input', () => {
        expect(deriveStoragePath('https://evil.com/x.jpg')).toBeNull()
        expect(deriveStoragePath(null)).toBeNull()
        expect(deriveStoragePath('')).toBeNull()
    })
})

describe('signWardrobeItems', () => {
    const makeSupabase = (signImpl: any) => ({
        storage: { from: vi.fn(() => ({ createSignedUrls: signImpl })) },
    })

    it('replaces image_url with a fresh signed URL', async () => {
        const items = [
            { id: '1', image_url: 'https://p.supabase.co/storage/v1/object/public/studio-wardrobe/u1/a.jpg' },
            { id: '2', image_url: 'https://p.supabase.co/storage/v1/object/public/studio-wardrobe/u1/b.jpg' },
        ]
        const createSignedUrls = vi.fn().mockResolvedValue({
            data: [
                { path: 'u1/a.jpg', signedUrl: 'https://signed/a?token=1', error: null },
                { path: 'u1/b.jpg', signedUrl: 'https://signed/b?token=2', error: null },
            ],
            error: null,
        })

        const result = await signWardrobeItems(makeSupabase(createSignedUrls) as any, items)

        expect(createSignedUrls).toHaveBeenCalledWith(['u1/a.jpg', 'u1/b.jpg'], 3600)
        expect(result[0].image_url).toBe('https://signed/a?token=1')
        expect(result[1].image_url).toBe('https://signed/b?token=2')
    })

    it('keeps the original url when signing fails (graceful degradation)', async () => {
        const items = [{ id: '1', image_url: 'https://p.supabase.co/storage/v1/object/public/studio-wardrobe/u1/a.jpg' }]
        const createSignedUrls = vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } })

        const result = await signWardrobeItems(makeSupabase(createSignedUrls) as any, items)

        expect(result[0].image_url).toBe(items[0].image_url)
    })

    it('does not call storage when there are no signable items', async () => {
        const createSignedUrls = vi.fn()
        const result = await signWardrobeItems(makeSupabase(createSignedUrls) as any, [
            { id: '1', image_url: null },
            { id: '2', image_url: 'https://evil.com/x.jpg' },
        ])

        expect(createSignedUrls).not.toHaveBeenCalled()
        expect(result).toHaveLength(2)
    })

    it('returns an empty list unchanged', async () => {
        const createSignedUrls = vi.fn()
        expect(await signWardrobeItems(makeSupabase(createSignedUrls) as any, [])).toEqual([])
        expect(createSignedUrls).not.toHaveBeenCalled()
    })
})
