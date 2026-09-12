import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

/**
 * Shared metadata construction: canonical URL, hreflang alternates, OG and
 * Twitter cards.
 *
 * Before this the app had exactly one static `metadata` export in the locale
 * layout, so every route shared one title, no canonical, and no hreflang —
 * which on a bilingual site tells search engines the two locales are
 * unrelated duplicates.
 */

export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL || 'https://theacstyle.com'
).replace(/\/$/, '');

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
