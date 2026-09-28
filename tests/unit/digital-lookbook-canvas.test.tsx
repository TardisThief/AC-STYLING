/**
 * The lookbook editor reads garments live and saves placements only
 * (migration 35, ARCH-001).
 *
 * It used to spread the whole garment row into each canvas entry and save
 * that: a signed photo URL that expires, the stylist's notes, every column.
 * A re-photographed garment kept its old picture on the canvas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/messages/en.json'

const h = vi.hoisted(() => ({
    rows: {} as Record<string, unknown[]>,
    updates: [] as { table: string; values: Record<string, unknown> }[],
}))

function query(table: string) {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) q[m] = () => q
    q.update = (values: Record<string, unknown>) => {
        h.updates.push({ table, values })
        return { eq: async () => ({ error: null }) }
    }
    q.then = (resolve: (v: unknown) => unknown) => resolve({ data: h.rows[table] ?? [], error: null })
    return q
}

vi.mock('@/utils/supabase/client', () => ({
    createClient: () => ({
        from: (table: string) => query(table),
        storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'thumb' } }) }) },
    }),
}))
// Signing is the live photo: the garment row's image, as the bucket serves it.
vi.mock('@/lib/wardrobe-images', () => ({
    signWardrobeItems: async (_: unknown, items: { image_url: string }[]) => items.map((i) => ({ ...i, image_url: `signed:${i.image_url}` })),
}))
vi.mock('html2canvas', () => ({ default: async () => ({ toBlob: (cb: (b: Blob) => void) => cb(new Blob(['x'])) }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import DigitalLookbook from '@/components/studio/DigitalLookbook'

const W = 'w1'
beforeEach(() => {
    h.updates = []
    h.rows = {
        wardrobe_items: [{ id: 'coat', category: 'Outerwear', image_url: 'wardrobe/w1/new-photo.jpg' }],
        lookbooks: [{
            id: 'lb1', title: 'Autumn', status: 'Published', collection_name: null, wardrobe_id: W,
            // As the editor used to save it: a snapshot, stale photo and all,
            // plus a garment that has since been deleted.
            lookbook_items: [
                { id: 'coat', x: 40, y: 60, width: 150, image_url: 'https://old.example/old-photo.jpg?token=expired', notes: 'stylist note' },
                { id: 'deleted-garment', x: 1, y: 1 },
            ],
        }],
    }
})

function open(isClientView: boolean) {
    render(
        <NextIntlClientProvider locale="en" messages={en}>
            <DigitalLookbook wardrobeId={W} ownerId="owner" isClientView={isClientView} />
        </NextIntlClientProvider>
    )
    return screen.findByRole('button', { name: /Autumn/ }).then((b) => fireEvent.click(b))
}

describe('the lookbook canvas', () => {
    it('shows each garment with its current photo, not the one saved on the canvas', async () => {
        await open(true)
        const img = await screen.findByAltText('Outerwear on the lookbook')
        expect(img).toHaveAttribute('src', 'signed:wardrobe/w1/new-photo.jpg')
        expect(screen.queryAllByRole('img').some((i) => i.getAttribute('src')?.includes('old-photo'))).toBe(false)
    })

    it('saves placements only, and drops a garment that is gone', async () => {
        await open(false)
        await screen.findByAltText('Outerwear on the lookbook')
        fireEvent.click(screen.getByRole('button', { name: /save/i }))

        await waitFor(() => expect(h.updates.some((u) => u.table === 'lookbooks')).toBe(true))
        const saved = h.updates.find((u) => u.table === 'lookbooks')!.values.lookbook_items
        expect(saved).toEqual([{ id: 'coat', x: 40, y: 60, width: 150 }])
    })
})
