/**
 * A service's text in the visitor's language.
 *
 * For a Spanish reader each of title, subtitle, description and price text is
 * the `_es` column when it is filled in, and the English one otherwise. The
 * Spanish columns are edited in the admin service form (title, subtitle and
 * description since 2026-09-29; the price column since migration 36, before
 * which the page read a price_display_es that did not exist).
 */

type ServiceText = {
    title: string;
    title_es: string | null;
    subtitle: string | null;
    subtitle_es: string | null;
    description: string | null;
    description_es: string | null;
    price_display: string | null;
    price_display_es: string | null;
};

const pick = (en: string | null, es: string | null, locale: string) =>
    locale === 'es' && es?.trim() ? es : en;

/** The price text a visitor sees, in her language. */
export function localizedServicePrice(
    row: Pick<ServiceText, 'price_display' | 'price_display_es'>,
    locale: string
): string | null {
    return pick(row.price_display, row.price_display_es, locale);
}

/** The service with its displayed text in her language (every other field untouched). */
export function localizeService<T extends ServiceText>(row: T, locale: string): T {
    return {
        ...row,
        title: pick(row.title, row.title_es, locale) ?? row.title,
        subtitle: pick(row.subtitle, row.subtitle_es, locale),
        description: pick(row.description, row.description_es, locale),
        price_display: localizedServicePrice(row, locale),
    };
}
