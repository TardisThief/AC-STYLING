import { z } from 'zod';
import { requiredText } from './parse';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

export const intakeUploadUrlSchema = z.object({
    token: requiredText('Intake token'),
    file_name: requiredText('File name').refine(
        name => ALLOWED_EXTENSIONS.includes(name.split('.').pop()?.toLowerCase() ?? ''),
        'Only JPG, PNG, WEBP, and HEIC files are allowed',
    ),
});

export const intakeItemSchema = z.object({
    token: requiredText('Intake token'),
    // The path our own createIntakeUploadUrl minted: wardrobe/<uuid>/<file>
    file_path: requiredText('File path').refine(
        path => /^wardrobe\/[0-9a-f-]{36}\/[^/]+$/i.test(path),
        'Invalid upload path',
    ),
    note: z.string().max(2000, 'Note is too long').nullish().transform(v => v ?? ''),
});
