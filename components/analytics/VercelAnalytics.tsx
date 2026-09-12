import Script from "next/script";

/**
 * Loads Vercel Analytics from its first-party path.
 *
 * Same-origin, so no CSP change and no third-party connection. On any host
 * that is not Vercel the request 404s and the page is unaffected — there is no
 * error surface and no fallback to write.
 *
 * See app/lib/analytics.ts for why this is not the npm package.
 */
export default function VercelAnalytics() {
    return (
        <Script
            src="/_vercel/insights/script.js"
            strategy="afterInteractive"
            data-endpoint="/_vercel/insights"
        />
    );
}
