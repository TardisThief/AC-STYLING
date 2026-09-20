"use client";

import Script from "next/script";
import { useTranslations } from "next-intl";

const CALENDLY_URL = "https://calendly.com/fashionstylist-ac/30min";

/**
 * The scheduler itself. Isolated as the page's only client component so the
 * surrounding copy — the part crawlers and screen readers actually read —
 * stays server-rendered.
 */
export default function CalendlyEmbed() {
    const t = useTranslations("BookPage");

    return (
        <div className="w-full bg-white/50 backdrop-blur-sm rounded-xl shadow-lg border border-ac-taupe/10 p-4 md:p-8">
            <div
                className="calendly-inline-widget w-full"
                data-url={CALENDLY_URL}
                style={{ minWidth: "320px", height: "700px" }}
            />
            {/* If the third-party widget is blocked or slow, the booking path
                must still exist rather than leaving an empty box. */}
            <noscript>
                <p className="text-center text-ac-taupe/80">
                    {t("schedulerFallback")}{" "}
                    <a className="underline" href={CALENDLY_URL}>
                        {t("schedulerFallbackLink")}
                    </a>
                </p>
            </noscript>
            <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
        </div>
    );
}
