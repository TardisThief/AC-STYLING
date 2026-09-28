/**
 * The Content-Security-Policy, as one list of what the app actually loads.
 *
 * Used by next.config.mjs (the header) and by tests/unit/csp.test.ts (which
 * pins that the policy allows every third party the code uses). Plain .mjs so
 * next.config.mjs can import it without a build step.
 *
 * History: shipped as Report-Only with no report endpoint, "so we can observe
 * violations". Nothing was ever observed, because nothing was collected;
 * Safari says so on every page ("the policy will have no effect"), and
 * `frame-ancestors` is ignored in report-only mode. The browser tests against
 * a local database (2026-09-28) then showed what it would have blocked: every
 * Supabase call to a non-*.supabase.co origin, and the Vimeo player's oEmbed
 * lookup. It is now enforced.
 *
 * Every source below is here for a named reason; add one the same way.
 */

/** The origin of a URL, or null if it is not one. */
function originOf(url) {
    try {
        return url ? new URL(url).origin : null;
    } catch {
        return null;
    }
}

/**
 * @param {{ supabaseUrl?: string, siteUrl?: string, dev?: boolean }} env
 * @returns {string}
 */
export function buildCsp({ supabaseUrl, siteUrl, dev = false } = {}) {
    // The project's own origin, whatever it is: *.supabase.co in production,
    // http://127.0.0.1:54321 for the browser tests.
    const supabase = originOf(supabaseUrl);
    const https = (originOf(siteUrl) ?? '').startsWith('https:');

    const directives = {
        'default-src': ["'self'"],
        // 'unsafe-inline': Next's inline bootstrap scripts and the JSON-LD
        // blocks (no nonces yet; parked in ROADMAP until the pages settle).
        // 'unsafe-eval' only in development, where React and HMR need it.
        // Calendly: the booking widget's script (/book, after consent).
        'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), 'https://assets.calendly.com'],
        // Inline styles: framer-motion and the style props throughout.
        'style-src': ["'self'", "'unsafe-inline'"],
        // Remote images come from Supabase Storage, Unsplash placeholders,
        // boutique product images from many shops, and Stripe; https: covers
        // them. The local test database serves over http, so it is named.
        'img-src': ["'self'", 'data:', 'blob:', 'https:', ...(supabase?.startsWith('http:') ? [supabase] : [])],
        'font-src': ["'self'", 'data:'],
        'connect-src': [
            "'self'",
            ...(supabase ? [supabase] : []),
            'https://*.supabase.co',
            // @vimeo/player looks the video up at vimeo.com/api/oembed.json
            // before it builds the iframe.
            'https://vimeo.com',
            'https://api.stripe.com',
            'https://*.vercel-insights.com',
            'https://va.vercel-scripts.com',
        ],
        'media-src': ["'self'", 'blob:'],
        'frame-src': ["'self'", 'https://player.vimeo.com', 'https://calendly.com', 'https://*.calendly.com', 'https://js.stripe.com'],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
    };

    const policy = Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(' ')}`);
    // Not over http (local runs): it would rewrite http://127.0.0.1 requests to https.
    if (https) policy.push('upgrade-insecure-requests');
    return policy.join('; ');
}
