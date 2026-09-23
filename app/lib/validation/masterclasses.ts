import { z } from 'zod';
import { requiredText, optionalText, orderIndex, resourceList } from './parse';

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
    resource_urls: resourceList('Resources'),
    stripe_product_id: optionalText,
    price_id: optionalText,
});
