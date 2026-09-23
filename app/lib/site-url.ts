/**
 * The canonical site URL, in a module of its own.
 *
 * It lives here rather than in `./seo.ts` because `seo.ts` imports the
 * next-intl routing config, and the transactional email templates — plain
 * strings assembled far from React — must be able to read this constant
 * without dragging next-intl's navigation module in behind it.
 *
 * `www` is canonical: production redirects the apex to `www` and Vercel sets
 * `NEXT_PUBLIC_SITE_URL` to the `www` host, so the fallback matches what the
 * deployment actually serves rather than quietly emitting a second origin.
 */
export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.theacstyle.com'
).replace(/\/$/, '');
