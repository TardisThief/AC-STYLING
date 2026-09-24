import { z } from 'zod';
import {
    requiredText,
    optionalText,
    optionalNumber,
    orderIndex,
    resourceList,
    booleanish,
} from './parse';

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
    // The three columns that decide whether a masterclass can appear on the
    // public sales page and be bought on its own. They were added by migration
    // 10 but never reached this schema, so they could only be set by editing
    // the database directly — which meant only Colorimetry ever had a price.
    is_published: booleanish,
    price_display: optionalText,
    runtime_minutes: optionalNumber('Runtime'),
});
