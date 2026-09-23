import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import { SITE_URL } from './site-url';

/**
 * Shared metadata construction: canonical URL, hreflang alternates, OG and
 * Twitter cards.
 *
 * Before this the app had exactly one static `metadata` export in the locale
 * layout, so every route shared one title, no canonical, and no hreflang —
 * which on a bilingual site tells search engines the two locales are
 * unrelated duplicates.
 */

// Defined in its own module so non-React consumers (the email templates) can
// read it without pulling next-intl in through this file; re-exported here
// because this is where the rest of the app already imports it from.
export { SITE_URL };

/** Absolute URL for a locale-prefixed path. `path` is locale-less, e.g. "/vault". */
export function localeUrl(locale: string, path = ''): string {
    const clean = path === '/' ? '' : path;
    return `${SITE_URL}/${locale}${clean}`;
}

interface BuildArgs {
    locale: string;
    /** Locale-less path, e.g. "/vault" or "" for the home page. */
    path?: string;
    title: string;
    description: string;
    /** Set false for pages that must stay out of the index. */
    index?: boolean;
    /** Locale-less path to an OG image route; defaults to the site card. */
    ogImage?: string;
}

export function buildMetadata({
    locale,
    path = '',
    title,
    description,
    index = true,
    ogImage,
}: BuildArgs): Metadata {
    const canonical = localeUrl(locale, path);

    // hreflang for every locale, plus x-default pointing at the default one.
    const languages: Record<string, string> = {};
    for (const l of routing.locales) languages[l] = localeUrl(l, path);
    languages['x-default'] = localeUrl(routing.defaultLocale, path);

    // `images` is spread in only when an explicit one is given. Setting the key
    // to undefined is not the same as omitting it: an explicit undefined blocks
    // Next's file-based opengraph-image.tsx from merging its own URL in, which
    // is exactly how the Vault card went missing the first time.
    const images = ogImage
        ? [{ url: `${SITE_URL}${ogImage}`, width: 1200, height: 630 }]
        : null;

    return {
        metadataBase: new URL(SITE_URL),
        title,
        description,
        alternates: { canonical, languages },
        robots: index ? undefined : { index: false, follow: false },
        openGraph: {
            type: 'website',
            siteName: 'AC Styling',
            locale,
            url: canonical,
            title,
            description,
            ...(images ? { images } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            ...(images ? { images: images.map((i) => i.url) } : {}),
        },
    };
}

/**
 * Per-page `generateMetadata`, reduced to one line at the call site.
 *
 * Before this, `buildMetadata` existed but was wired up on exactly one page, so
 * 24 of 30 routes inherited the locale layout's single generic title and
 * shipped no canonical and no hreflang. The copy lives under the `Meta`
 * namespace in `messages/*.json`, keyed by `key`, like every other
 * user-facing string.
 *
 * `path` is the locale-less public path. Omit it for gated routes: a noindex
 * page has nothing to be canonical about, and pointing one at a parent path
 * would be an actively wrong signal. Those get a title, a description and
 * `noindex, nofollow` — which is what a browser tab and a shared link need,
 * and nothing more.
 */
export function pageMetadata({
    path,
    key,
    ogImage,
}: {
    path?: string;
    key: string;
    ogImage?: string;
}) {
    return async function generateMetadata({
        params,
    }: {
        params: Promise<{ locale: string }>;
    }): Promise<Metadata> {
        const { locale } = await params;
        const { getTranslations } = await import('next-intl/server');
        const t = await getTranslations({ locale, namespace: 'Meta' });
        const title = t(`${key}.title`);
        const description = t(`${key}.description`);

        if (!path) {
            return {
                metadataBase: new URL(SITE_URL),
                title,
                description,
                robots: { index: false, follow: false },
            };
        }

        return buildMetadata({ locale, path, title, description, ogImage });
    };
}
