/**
 * A lookbook's canvas: where each garment sits, and nothing else.
 *
 * Stored in lookbooks.lookbook_items as [{id, x, y, width}], `id` being the
 * wardrobe item's (migration 35). The garment itself, and its photo, are read
 * live from wardrobe_items, so a garment re-photographed, moved to another
 * folder or deleted is right on every canvas without anyone rewriting JSON.
 * Entries used to be full snapshots of the garment row, which went stale and
 * had to be rewritten when a wardrobe's photos moved (ARCH-001).
 */

export interface CanvasPlacement {
    /** The wardrobe item this placement shows. */
    id: string;
    x?: number;
    y?: number;
    width?: number;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * Read a stored canvas. Tolerates anything the column has ever held (the old
 * snapshots carried the same `id`) and drops what is not a placement.
 */
export function readCanvas(stored: unknown): CanvasPlacement[] {
    if (!Array.isArray(stored)) return [];
    const out: CanvasPlacement[] = [];
    for (const entry of stored) {
        if (!entry || typeof entry !== 'object') continue;
        const e = entry as Record<string, unknown>;
        if (typeof e.id !== 'string' || !e.id) continue;
        const p: CanvasPlacement = { id: e.id };
        const x = num(e.x), y = num(e.y), width = num(e.width);
        if (x !== undefined) p.x = x;
        if (y !== undefined) p.y = y;
        if (width !== undefined) p.width = width;
        out.push(p);
    }
    return out;
}

/**
 * What to store: placements only, and only for garments still in the
 * wardrobe (a deleted garment's placement is dropped the next time it saves).
 */
export function canvasToStore(placements: CanvasPlacement[], existingIds: ReadonlySet<string>): CanvasPlacement[] {
    return placements
        .filter((p) => existingIds.has(p.id))
        .map(({ id, x, y, width }) => {
            const p: CanvasPlacement = { id };
            if (x !== undefined) p.x = x;
            if (y !== undefined) p.y = y;
            if (width !== undefined) p.width = width;
            return p;
        });
}

/** Move one placement by a drag's offset. Returns a new canvas. */
export function moveBy(placements: CanvasPlacement[], index: number, dx: number, dy: number): CanvasPlacement[] {
    return placements.map((p, i) => (i === index ? { ...p, x: Math.round((p.x ?? 0) + dx), y: Math.round((p.y ?? 0) + dy) } : p));
}
