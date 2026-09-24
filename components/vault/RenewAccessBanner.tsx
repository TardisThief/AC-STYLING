import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getRenewalQuote } from "@/app/actions/stripe";
import { RENEWAL_GRACE_DAYS, renewalNotice } from "@/app/lib/entitlement-period";
import RenewAccessButton from "./RenewAccessButton";

/**
 * The one place in the Vault that tells her when her year ends and what the
 * next one costs.
 *
 * It quotes the actual number rather than describing the ladder, because "two
 * thirds of what you paid" is a rule and "$100" is an answer. The rule is on
 * the sales page and in the terms; here she wants the price.
 *
 * Renders nothing at all until the last thirty days of her term — the whole
 * middle of the year should have no banner in it. Which of the three things it
 * says is decided by `renewalNotice`, not by comparing dates here: reading the
 * clock during render is impure, and the ended/lapsed distinction is worth
 * testing on its own.
 */

interface Props {
    locale: string;
    accessExpiresAt: string | null | undefined;
}

export default async function RenewAccessBanner({ locale, accessExpiresAt }: Props) {
    const notice = renewalNotice(accessExpiresAt);
    if (notice === "none") return null;

    // Only now, once we know something is going to be said, is the quote worth
    // the queries it costs.
    const quote = await getRenewalQuote();
    if ("error" in quote) return null;

    const t = await getTranslations({ locale, namespace: "Vault.renewal" });

    const date = (iso: string) =>
        new Intl.DateTimeFormat(locale === "es" ? "es" : "en", {
            day: "numeric",
            month: "long",
            year: "numeric",
        }).format(new Date(iso));

    const price = new Intl.NumberFormat(locale === "es" ? "es" : "en", {
        style: "currency",
        currency: quote.currency.toUpperCase(),
    }).format(quote.amountCents / 100);

    const ended = notice !== "soon";
    // Past the grace window her rung is gone; quoting "renew for $50" would be
    // naming a price we will refuse to honour.
    const lapsed = notice === "lapsed";

    return (
        <aside
            className={`mb-8 border p-5 md:p-6 ${
                ended ? "border-ac-taupe/40 bg-ac-beige/50" : "border-ac-taupe/20 bg-white/50"
            }`}
        >
            <h2 className="font-serif text-xl text-ac-taupe">
                {lapsed
                    ? t("resetTitle")
                    : ended
                      ? t("endedTitle")
                      : t("soonTitle", { date: date(quote.expiresAt) })}
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ac-taupe/85">
                {lapsed
                    ? t("resetBody", { days: RENEWAL_GRACE_DAYS })
                    : ended
                      ? t("endedBody", { price, graceEnd: date(quote.graceEnd) })
                      : t("soonBody", { price })}
            </p>
            <div className="mt-5">
                {lapsed ? (
                    <Link
                        href="/vault/join"
                        className="inline-block border border-ac-taupe/40 px-6 py-3 text-xs font-bold uppercase tracking-widest text-ac-taupe transition-colors hover:border-ac-taupe hover:bg-ac-taupe hover:text-ac-sand"
                    >
                        {t("resetCta")}
                    </Link>
                ) : (
                    <RenewAccessButton
                        label={t("cta", { price })}
                        errorLabel={t("error")}
                        className="inline-block bg-ac-espresso px-6 py-3 text-xs font-bold uppercase tracking-widest text-ac-sand transition-colors hover:bg-ac-taupe"
                    />
                )}
            </div>
        </aside>
    );
}
