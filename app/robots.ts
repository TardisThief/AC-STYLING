import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/app/lib/seo';

/**
 * Everything under /vault is either gated or deliberately unlisted, and the
 * Studio upload tokens must never be crawled. The public Vault sales page is
 * allowed explicitly so that disallowing the directory does not also hide it
 * once its own noindex is lifted.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/en/vault', '/es/vault'],
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
