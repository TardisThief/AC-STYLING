import { z } from 'zod';
import { requiredText, optionalText, optionalNumber, optionalUuid, orderIndex } from './parse';

export const brandSchema = z.object({
    name: requiredText('Name'),
    logo_url: optionalText,
    website_url: optionalText,
    active: z.boolean().optional().default(true),
    contact_name: optionalText,
    contact_email: z.preprocess(
        value => (value === '' || value === null || value === undefined ? null : value),
        z.email({ error: 'Contact email must be a valid email address' }).nullable(),
    ),
    commission_rate: optionalNumber('Commission rate'),
    // Mirrors the DB CHECK constraint so admins get a readable message.
    partnership_status: z.preprocess(
        value => value || 'active',
        z.enum(['active', 'prospect', 'paused', 'inactive'], {
            error: 'Partnership status must be active, prospect, paused, or inactive',
        }),
    ),
    internal_notes: optionalText,
});

export const boutiqueItemSchema = z.object({
    name: requiredText('Name'),
    brand_id: optionalUuid('Brand'),
    image_url: requiredText('Image URL'),
    curator_note: optionalText,
    affiliate_url_usa: optionalText,
    affiliate_url_es: optionalText,
    category: optionalText,
    active: z.boolean().optional().default(true),
});

export const collectionSchema = z.object({
    title: requiredText('Title'),
    title_es: optionalText,
    description: optionalText,
    description_es: optionalText,
    cover_image_url: optionalText,
    active: z.boolean().optional().default(true),
    order_index: orderIndex,
});

export const trustedByLogoSchema = z.object({
    name: requiredText('Name'),
    logo_url: requiredText('Logo URL'),
    order_index: orderIndex,
});

/** Partial update: TrustedByManager sends e.g. { active } or { order_index } alone. */
export const trustedByLogoUpdateSchema = trustedByLogoSchema
    .extend({ active: z.boolean() })
    .partial();
