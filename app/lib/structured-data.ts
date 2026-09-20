import { SITE_URL, localeUrl } from '@/app/lib/seo';

/**
 * Structured data for the brand entity.
 *
 * `Organization`, not `LocalBusiness`: AC Styling is a service brand delivered
 * over video, with no storefront and no walk-in hours. `LocalBusiness` would
 * invite Google to treat it as a place customers visit and to ask for opening
 * hours and a service area it does not have. The postal address below is the
 * registered company address that the legal terms already publish, which is
 * what `Organization.address` is for.
 *
 * Every field here is asserted somewhere a human can also read it — the footer
 * links, the legal terms, the page's own metadata description — so the markup
 * cannot quietly drift into claiming something the site does not say.
 */
export function organizationJsonLd(locale: string, description: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'AC Styling',
        url: localeUrl(locale, ''),
        logo: `${SITE_URL}/logo.png`,
        image: `${SITE_URL}/logo.png`,
        description,
        email: 'fashionstylist.ac@gmail.com',
        founder: {
            '@type': 'Person',
            name: 'Alejandra Carrillo',
        },
        address: {
            '@type': 'PostalAddress',
            streetAddress: '1865 S Ocean Dr',
            addressLocality: 'Hallandale Beach',
            addressRegion: 'FL',
            postalCode: '33009',
            addressCountry: 'US',
        },
        // The same two accounts the footer and the contact section link to.
        sameAs: [
            'https://www.instagram.com/ac.stylingcoach/',
            'https://www.tiktok.com/@ac.styling',
        ],
    };
}

/**
 * A `FAQPage` built from the questions the page actually renders.
 *
 * Google restricted FAQ rich results to a narrow set of authoritative sites in
 * 2023, so this is unlikely to win a rich snippet on its own. It stays because
 * it is still valid, still read by other consumers of structured data, and
 * costs nothing — not because it is expected to change the SERP.
 */
export function faqPageJsonLd(faqs: ReadonlyArray<{ q: string; a: string }>) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
        })),
    };
}
