/**
 * The price text a visitor sees for a service, in her language.
 *
 * services.price_display_es (migration 36) when she reads Spanish and it is
 * filled in; price_display otherwise. The Services page used to read a
 * price_display_es that did not exist, so Spanish always fell back.
 */
export function localizedServicePrice(
    row: { price_display: string | null; price_display_es: string | null },
    locale: string
): string | null {
    if (locale === 'es' && row.price_display_es?.trim()) return row.price_display_es;
    return row.price_display;
}
