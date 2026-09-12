import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { localeUrl } from '@/app/lib/seo';

/**
 * Public, indexable routes only.
 *
 * /vault-access — the public sales page — is deliberately ABSENT while it
 * ships noindex, because listing a noindex URL is a contradictory signal. It
 * joins this list in the same change that sets VAULT_INDEXABLE, so the two can
 * never drift apart. /vault itself is members-only and never belongs here.
 */
const PUBLIC_PATHS: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '', priority: 1.0, changeFrequency: 'monthly' },
    { path: '/book', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/legal/terms', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/legal/privacy', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/legal/refunds', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    return PUBLIC_PATHS.flatMap(({ path, priority, changeFrequency }) =>
        routing.locales.map((locale) => ({
            url: localeUrl(locale, path),
            lastModified: now,
            changeFrequency,
            priority,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((l) => [l, localeUrl(l, path)])
                ),
            },
        }))
    );
}
