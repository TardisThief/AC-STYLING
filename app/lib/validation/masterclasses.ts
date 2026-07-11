import { z } from 'zod';
import { requiredText, optionalText, orderIndex } from './parse';

export const masterclassSchema = z.object({
    title: requiredText('Title'),
    subtitle: optionalText,
    description: optionalText,
    title_es: optionalText,
    subtitle_es: optionalText,
    description_es: optionalText,
    thumbnail_url: optionalText,
    video_url: optionalText,
    order_index: orderIndex,
    stripe_product_id: optionalText,
    price_id: optionalText,
});
