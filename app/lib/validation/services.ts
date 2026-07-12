import { z } from 'zod';
import { requiredText, optionalTextPreserve, upsertId } from './parse';

/**
 * Upsert payload for `services` (see ServiceForm's dbPayload). Absent optional
 * keys stay absent; the row is built from this schema's output ONLY.
 */
export const serviceSchema = z.object({
    id: upsertId('Service id'),
    title: requiredText('Title'),
    subtitle: optionalTextPreserve,
    description: optionalTextPreserve,
    price_display: optionalTextPreserve,
    price_id: optionalTextPreserve,
    stripe_url: optionalTextPreserve,
    stripe_product_id: optionalTextPreserve,
    image_url: optionalTextPreserve,
    // Mirrors the DB CHECK constraint.
    type: z.preprocess(
        value => (value === '' || value === null ? undefined : value),
        z.enum(['session', 'retainer'], { error: 'Type must be session or retainer' }).optional(),
    ),
    recommendation_tags: z.array(z.string({ error: 'Tags must be text' })).optional(),
    active: z.boolean().optional(),
    order_index: z.preprocess(
        value => (value === '' || value === null ? undefined : value),
        z.coerce.number({ error: 'Order must be a number' }).int('Order must be a whole number').optional(),
    ),
    unlocks_studio_access: z.boolean().optional(),
    title_es: optionalTextPreserve,
    subtitle_es: optionalTextPreserve,
    description_es: optionalTextPreserve,
});
