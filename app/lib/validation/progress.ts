import { z } from 'zod';
import { uuid } from './parse';

/**
 * Course progress (app/actions/essence-lab.ts). The browser used to insert
 * `user_progress` itself with a content id it built, so any member could mark
 * any chapter mastered or unlock any chapter's Lab (2026-09-29). Now the
 * browser names the chapter and the server decides the rest.
 */
export const completeChapterSchema = z.object({
    chapterId: uuid('Chapter'),
});

export const labUnlockSchema = z.object({
    chapterSlug: z.string({ error: 'Chapter is invalid' }).trim().min(1, { error: 'Chapter is invalid' }).max(200, { error: 'Chapter is invalid' }),
});
