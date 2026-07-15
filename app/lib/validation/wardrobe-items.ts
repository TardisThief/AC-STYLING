import { z } from 'zod';
import { uuid, optionalTextPreserve } from './parse';

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags'] as const;
const STATUSES = ['Keep', 'Tailor', 'Donate', 'Archive'] as const;

/**
 * Fields an admin may edit on a wardrobe item. Schema output keys are DB column
 * names; only `parsed.data` is ever written.
 *
 * `internal_note` is Ale's private note and lives here rather than on the
 * browser client on purpose: clients hold an authenticated Supabase client with
 * column access to their own rows, so a note is only private if the client can
 * neither read nor write the column directly.
 */
export const adminWardrobeItemUpdateSchema = z.object({
    category: z.enum(CATEGORIES, { error: 'Unknown category' }).optional(),
    status: z.enum(STATUSES, { error: 'Unknown status' }).optional(),
    brand: optionalTextPreserve,
    client_note: optionalTextPreserve,
    notes: optionalTextPreserve,
    internal_note: optionalTextPreserve,
    tags: z.array(z.string({ error: 'Tags must be text' })).optional(),
    product_link_id: z.union([uuid('Product link'), z.null()]).optional(),
});

/** Bulk status tagging: one status applied to many items in one round-trip. */
export const bulkStatusSchema = z.object({
    item_ids: z
        .array(uuid('Item id'), { error: 'Select at least one item' })
        .min(1, { error: 'Select at least one item' })
        .max(200, { error: 'Too many items selected at once (max 200)' }),
    status: z.enum(STATUSES, { error: 'Unknown status' }),
});

export const CATEGORY_VALUES = CATEGORIES;
export const STATUS_VALUES = STATUSES;
