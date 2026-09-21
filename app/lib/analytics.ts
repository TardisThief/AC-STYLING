/**
 * Vercel Analytics, loaded as the first-party script rather than through
 * `@vercel/analytics`.
 *
 * The npm package is a thin wrapper that injects `/_vercel/insights/script.js`
 * and exposes `window.va`. Installing it here was not worth what it cost: its
 * optional `@sveltejs/kit` peer makes npm resolve SvelteKit and vite@8 against
 * this project's vite@7, and the only resolution npm offered added 70 packages
 * and REMOVED `@swc/helpers`, which Next depends on at runtime. Loading the
 * script directly gets the same product with no dependency at all.
 *
 * The script and its beacon are same-origin (Vercel serves `/_vercel/insights/*`
 * at the edge), so the existing CSP `script-src 'self'` / `connect-src 'self'`
 * already permit it. Off Vercel — local `npm start`, or any other host — the
 * path simply 404s and `window.va` stays undefined, which every call below
 * tolerates.
 */

type VaArgs = [event: 'event', props: { name: string } & Record<string, unknown>];

declare global {
    interface Window {
        va?: (...args: VaArgs) => void;
    }
}

/** Which section of the sales page a conversion came from. */
export type CtaSection =
    | 'hero'
    | 'catalog'
    | 'flagship'
    | 'offer_full'
    | 'offer_masterclass_pass'
    | 'offer_single'
    | 'bridge'
    | 'whatsapp'
    | 'closing'
    | 'sticky';

export type CtaTarget = 'checkout' | 'calendly' | 'whatsapp' | 'anchor';

/**
 * One event with dimensions, not eight event names: section attribution stays
 * answerable with a single query, and adding a section later needs no new
 * event registered anywhere.
 */
export function trackCta(section: CtaSection, target: CtaTarget): void {
    if (typeof window === 'undefined') return;
    try {
        window.va?.('event', { name: 'vault_cta', section, target });
    } catch {
        // Analytics must never break a purchase.
    }
}
