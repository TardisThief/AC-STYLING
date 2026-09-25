import { z } from 'zod';
import { requiredText, uuid } from './parse';

/**
 * Admin edit of a wardrobe row (updateWardrobe). Every field is optional —
 * StudioDashboard and ArchiveManager send `{ status }` alone — but only these
 * three columns can be written. The token, its expiry and the row's identity
 * are deliberately absent: the action used to spread its argument straight
 * into the update, so `upload_token_expires_at: null` made an intake link
 * permanent. Token changes go through regenerateUploadToken.
 */
export const wardrobeUpdateSchema = z.object({
    title: requiredText('Title').optional(),
    owner_id: z.union([uuid('Owner'), z.null()]).optional(),
    status: z.enum(['active', 'archived'], { error: 'Status must be active or archived' }).optional(),
});
