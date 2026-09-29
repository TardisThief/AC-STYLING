import { z } from 'zod';
import { uuid, optionalTextPreserve, isHttpUrl } from './parse';

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

/**
 * A garment the stylist adds to a wardrobe (VirtualWardrobe's admin view:
 * direct upload, boutique import, save from a shop link). Exactly one image
 * source: `file_path`, a photo uploaded to the wardrobe's folder through
 * getAdminItemUploadUrl, or `image_url`, an external http(s) image (a boutique
 * product's, or one pulled from a link). These used to be browser inserts that
 * relied on RLS alone (2026-09-29).
 */
const imageSource = {
    file_path: z.string().trim().min(1).max(300).optional(),
    image_url: z.string().trim().max(2000).refine(isHttpUrl, { error: 'The image must be an http(s) link' }).optional(),
};
const onlyOneImage = (v: { file_path?: string; image_url?: string }) => Boolean(v.file_path) !== Boolean(v.image_url);
const ONE_IMAGE = { error: 'Give exactly one image: an upload or a link' };

export const adminNewItemSchema = z.object({
    wardrobe_id: uuid('Wardrobe'),
    ...imageSource,
    // Free text rather than the enum: a boutique product's category comes with it.
    category: z.string().trim().max(60).optional(),
    status: z.enum(STATUSES, { error: 'Unknown status' }).optional(),
    brand: optionalTextPreserve,
    notes: optionalTextPreserve,
    product_link_id: z.union([uuid('Product link'), z.null()]).optional(),
}).refine(onlyOneImage, ONE_IMAGE);

/** A new photo for an existing garment ("Change Image"). */
export const adminItemImageSchema = z.object({
    item_id: uuid('Item'),
    ...imageSource,
}).refine(onlyOneImage, ONE_IMAGE);
