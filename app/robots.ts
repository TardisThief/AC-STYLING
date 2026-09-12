import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/app/lib/seo';

/**
 * Everything under /vault is gated, and the Studio upload tokens must never be
 * crawled. The public sales page lives at /vault-access, outside that
 * directory, and is allowed explicitly.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/en/vault-access', '/es/vault-access'],
                disallow: [
                    '/api/',
                    '/auth/',
                    '/en/vault/',
                    '/es/vault/',
                    '/en/studio/',
                    '/es/studio/',
                ],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
