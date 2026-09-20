"use client";

import { useState, useSyncExternalStore } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { CalendarCheck } from "lucide-react";

const CALENDLY_URL = "https://calendly.com/fashionstylist-ac/30min";

/** Per-viewer convenience only — never read back by us, never a source of truth. */
const CONSENT_KEY = "ac.calendly-consent";

/**
 * The scheduler, behind an in-place consent gate.
 *
 * Calendly is the only third party on this site that sets cookies, so it is not
 * loaded until the visitor asks for it: no script, no iframe, no request. That
 * is why there is no site-wide cookie banner — a banner on every page would be
 * asking about a thing that only exists on this one.
 *
 * Isolated as the booking page's only client component so the surrounding copy
 * — the part crawlers and screen readers actually read — stays server-rendered.
 */
/** Cross-tab: revoking consent in one tab closes the gate in the others. */
function subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
}

function readConsent() {
    try {
        return window.localStorage.getItem(CONSENT_KEY) === "granted";
    } catch {
        // Private windows and blocked site data throw on access. The gate stays
        // closed, which is the safe direction to fail.
        return false;
    }
}

/** The server has no localStorage, so it always renders the gate. */
function serverConsent() {
    return false;
}

export default function CalendlyEmbed() {
    const t = useTranslations("BookPage");
    // Read through useSyncExternalStore rather than an effect: the value comes
    // from outside React, the server snapshot is what keeps hydration honest,
    // and there is no setState-in-an-effect cascade.
    const remembered = useSyncExternalStore(subscribe, readConsent, serverConsent);
    const [acceptedNow, setAcceptedNow] = useState(false);
    const loaded = remembered || acceptedNow;

    function accept() {
        setAcceptedNow(true);
        try {
            window.localStorage.setItem(CONSENT_KEY, "granted");
        } catch {
            // Remembering is a convenience; the scheduler still loads this visit.
        }
    }

    if (!loaded) {
        return (
            <div className="w-full bg-white/50 backdrop-blur-sm rounded-xl shadow-lg border border-ac-taupe/10 p-8 md:p-12 text-center">
                <CalendarCheck className="mx-auto mb-4 h-8 w-8 text-ac-taupe/40" aria-hidden="true" />
                <h3 className="font-serif text-2xl text-ac-taupe mb-3">{t("consentTitle")}</h3>
                <p className="font-sans text-sm text-ac-taupe/75 leading-relaxed max-w-lg mx-auto mb-6 text-pretty">
                    {t("consentBody")}
                </p>
                <button
                    type="button"
                    onClick={accept}
                    className="px-8 py-3 bg-ac-taupe text-ac-sand font-sans uppercase tracking-widest text-xs font-semibold rounded-sm hover:bg-ac-espresso transition-colors duration-300"
                >
                    {t("consentAction")}
                </button>
                <p className="font-sans text-xs text-ac-taupe/50 mt-4">{t("consentRemember")}</p>
                {/* With scripting off the button above cannot work, so the
                    booking path has to exist without it. */}
                <noscript>
                    <p className="font-sans text-sm text-ac-taupe/75 mt-4">
                        {t("schedulerFallback")}{" "}
                        <a className="underline" href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
                            {t("schedulerFallbackLink")}
                        </a>
                    </p>
                </noscript>
                <p className="font-sans text-xs text-ac-taupe/60 mt-6">
                    <a
                        className="underline hover:text-ac-taupe"
                        href={CALENDLY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t("consentAlternative")}
                    </a>
                    <span className="mx-2 text-ac-taupe/30">·</span>
                    <Link className="underline hover:text-ac-taupe" href="/legal/privacy#cookies">
                        {t("consentPolicyLink")}
                    </Link>
                </p>
            </div>
        );
    }

    return (
        <div className="w-full bg-white/50 backdrop-blur-sm rounded-xl shadow-lg border border-ac-taupe/10 p-4 md:p-8">
            <div
                className="calendly-inline-widget w-full"
                data-url={CALENDLY_URL}
                style={{ minWidth: "320px", height: "700px" }}
            />
            <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
        </div>
    );
}
