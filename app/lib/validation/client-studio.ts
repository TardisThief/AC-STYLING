import { z } from 'zod';
import { optionalTextPreserve } from './parse';
import { CATEGORY_VALUES } from './wardrobe-items';

/**
 * What a Studio client may change herself, from her own view.
 *
 * Deliberately narrower than the stylist's schema (adminWardrobeItemUpdateSchema):
 * no status (the stylist's curation call), no `notes` (the stylist's note to
 * her), no `internal_note`, no image or product link. Unknown keys are
 * stripped, so a POSTed `status` or `wardrobe_id` never reaches the update.
 */
export const clientItemUpdateSchema = z.object({
    category: z.enum(CATEGORY_VALUES, { error: 'Unknown category' }).optional(),
    brand: optionalTextPreserve,
    tags: z
        .array(z.string({ error: 'Tags must be text' }).trim().max(50, { error: 'Tags are at most 50 characters' }), { error: 'Tags must be a list' })
        .max(50, { error: 'At most 50 tags' })
        .optional(),
    client_note: optionalTextPreserve,
});

/** The fields TailorCardUser offers; anything else is not a measurement. */
export const MEASUREMENT_KEYS = ['bust', 'waist', 'hips', 'inseam', 'shoulders', 'height', 'shoe_size'] as const;

export const measurementsSchema = z.partialRecord(
    z.enum(MEASUREMENT_KEYS, { error: 'Unknown measurement' }),
    z.string({ error: 'Measurements must be text' }).trim().max(40, { error: 'A measurement is at most 40 characters' }),
);
