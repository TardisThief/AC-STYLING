import { z } from 'zod';
import {
    requiredText,
    optionalText,
    optionalUuid,
    orderIndex,
    jsonArray,
    booleanish,
} from './parse';

/**
 * Chapter payload (fed from the admin form's FormData after key mapping in the
 * action). slug/title/video_id are NOT NULL in the DB; category mirrors the DB
 * CHECK constraint; the jsonb fields accept JSON strings safely.
 */
export const chapterSchema = z
    .object({
        slug: requiredText('Slug'),
        title: requiredText('Title'),
        subtitle: optionalText,
        description: optionalText,
        title_es: optionalText,
        subtitle_es: optionalText,
        description_es: optionalText,
        video_id: requiredText('Video ID'),
        video_id_es: optionalText,
        thumbnail_url: optionalText,
        category: z.preprocess(
            value => value || 'masterclass',
            z.enum(['masterclass', 'course'], { error: 'Category must be masterclass or course' }),
        ),
        order_index: orderIndex,
        masterclass_id: optionalUuid('Masterclass'),
        is_standalone: booleanish,
        lab_questions: jsonArray('Lab questions'),
        takeaways: jsonArray('Takeaways'),
        takeaways_es: jsonArray('Takeaways (Spanish)'),
        resource_urls: jsonArray('Resource URLs'),
        stripe_product_id: optionalText,
        price_id: optionalText,
    })
    // A chapter attached to a masterclass is never standalone.
    .transform(data => ({
        ...data,
        is_standalone: data.masterclass_id ? false : data.is_standalone,
    }));
