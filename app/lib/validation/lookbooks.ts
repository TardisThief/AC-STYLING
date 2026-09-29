import { z } from 'zod';
import { optionalTextPreserve, requiredText, uuid } from './parse';

/**
 * Lookbook writes from the Studio (app/actions/lookbooks.ts). The editor used
 * to write lookbooks straight from the browser, relying on RLS alone; now each
 * write is a guarded action that stores only these fields (2026-09-29).
 */

/** One garment on the canvas (migration 35): which garment, and where. Extra keys are stripped. */
const coordinate = z.number({ error: 'Positions must be numbers' }).finite().min(-10000).max(10000);
export const placementSchema = z.object({
    id: uuid('Canvas item'),
    x: coordinate.optional(),
    y: coordinate.optional(),
    width: z.number({ error: 'Width must be a number' }).finite().min(10).max(4000).optional(),
});

export const createLookbookSchema = z.object({
    wardrobe_id: uuid('Wardrobe'),
    title: requiredText('Title'),
    collection_name: optionalTextPreserve,
});

export const saveLookbookSchema = z.object({
    id: uuid('Lookbook'),
    lookbook_items: z.array(placementSchema, { error: 'The canvas must be a list' }).max(300, { error: 'At most 300 garments on a canvas' }),
    /** Set when a new thumbnail was uploaded to the path getLookbookThumbnailUploadUrl gave. */
    thumbnail_path: z.string().trim().min(1).max(300).optional(),
});

export const lookbookStatusSchema = z.object({
    id: uuid('Lookbook'),
    status: z.enum(['Draft', 'Published'], { error: 'Status must be Draft or Published' }),
});
