import Script from "next/script";
import { isEnabled } from '@/app/lib/env-flags';

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
    // Gated on an explicit flag. When Web Analytics is not enabled for the
    // project, /_vercel/insights/script.js returns an HTML 404 and the browser
    // logs "Refused to execute script ... MIME type ('text/html')" on every
    // page load. Set NEXT_PUBLIC_VERCEL_ANALYTICS=true once it is switched on
    // in the Vercel dashboard.
    if (!isEnabled(process.env.NEXT_PUBLIC_VERCEL_ANALYTICS)) return null;

    return (
        <Script
            src="/_vercel/insights/script.js"
            strategy="afterInteractive"
            data-endpoint="/_vercel/insights"
        />
    );
}
