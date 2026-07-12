import { z } from 'zod';
import { requiredText, optionalTextPreserve, upsertId } from './parse';

/**
 * Upsert payload for `offers`. Absent optional keys stay absent so the upsert
 * only writes columns the form actually sent (the row is built from this
 * schema's output ONLY — that is the mass-assignment fix).
 */
export const offerSchema = z.object({
    id: upsertId('Offer id'),
    slug: requiredText('Slug'),
    title: requiredText('Title'),
    title_es: optionalTextPreserve,
    description: optionalTextPreserve,
    description_es: optionalTextPreserve,
    price_display: optionalTextPreserve,
    price_id: optionalTextPreserve,
    stripe_product_id: optionalTextPreserve,
    active: z.boolean().optional(),
});
