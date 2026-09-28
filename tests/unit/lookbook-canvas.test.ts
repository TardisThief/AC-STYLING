/**
 * The lookbook canvas stores placements, not garments (migration 35), and a
 * drag is kept (app/lib/lookbook-canvas.ts).
 *
 * Two defects this pins, both found 2026-09-28 (ARCH-001 work):
 *  - entries snapshotted the whole garment row, signed photo URL and the
 *    stylist's notes included, so they went stale and leaked fields the
 *    canvas never needed;
 *  - DigitalLookbook computed a dragged position and never stored it, so
 *    "Save" wrote the original positions and every arrangement was lost.
 */
import { describe, it, expect } from 'vitest'
import { canvasToStore, moveBy, readCanvas } from '@/app/lib/lookbook-canvas'

describe('readCanvas', () => {
    it('reads references, and old snapshots by their id, dropping everything else', () => {
        const stored = [
            { id: 'a', x: 10, y: 20, width: 150 },
            { id: 'b', x: 5, image_url: 'https://signed.example/b.jpg?token=x', notes: 'stylist note', category: 'Tops' },
            { image_url: 'no-id.jpg' },
            null,
            'text',
            { id: 'c', x: 'NaN' },
        ]
        expect(readCanvas(stored)).toEqual([{ id: 'a', x: 10, y: 20, width: 150 }, { id: 'b', x: 5 }, { id: 'c' }])
    })

    it('is empty for anything that is not a list', () => {
        expect(readCanvas(null)).toEqual([])
        expect(readCanvas({ id: 'a' })).toEqual([])
    })
})

describe('canvasToStore', () => {
    it('stores placements only, for garments still in the wardrobe', () => {
        const withExtras = [
            { id: 'a', x: 1, y: 2, width: 3, image_url: 'x', notes: 'y' },
            { id: 'gone', x: 1 },
        ] as unknown as Parameters<typeof canvasToStore>[0]
        expect(canvasToStore(withExtras, new Set(['a']))).toEqual([{ id: 'a', x: 1, y: 2, width: 3 }])
    })
})

describe('moveBy', () => {
    it('keeps the dragged position, and only for the dragged garment', () => {
        const canvas = [{ id: 'a', x: 50, y: 50 }, { id: 'b', x: 10, y: 10 }]
        expect(moveBy(canvas, 0, 120.4, -30.6)).toEqual([{ id: 'a', x: 170, y: 19 }, { id: 'b', x: 10, y: 10 }])
        expect(canvas[0]).toEqual({ id: 'a', x: 50, y: 50 })
    })

    it('starts an unplaced garment from the corner', () => {
        expect(moveBy([{ id: 'a' }], 0, 5, 7)).toEqual([{ id: 'a', x: 5, y: 7 }])
    })
})
