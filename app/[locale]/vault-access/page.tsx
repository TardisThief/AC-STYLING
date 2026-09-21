import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildMetadata } from "@/app/lib/seo";
import Navbar from "@/components/Navbar";
import Spine from "@/components/vault-sales/Spine";
import CatalogCard from "@/components/vault-sales/CatalogCard";
import FlagshipCurriculum from "@/components/vault-sales/FlagshipCurriculum";
import TrackedCta from "@/components/vault-sales/TrackedCta";
import VaultCheckoutButton from "@/components/vault-sales/VaultCheckoutButton";
import dynamic from "next/dynamic";
import TrustedBy from "@/components/TrustedBy";

// Code-split the below-the-fold client components. LCP here is render-delay
// bound -- ~1.5s of script evaluation on a throttled mobile CPU -- and none of
// these are needed to paint the hero. They still server-render; only their
// JavaScript is deferred to its own chunk.
const ColorField = dynamic(() => import("@/components/vault-sales/ColorField"));
const StickyCta = dynamic(() => import("@/components/vault-sales/StickyCta"));
import Footer from "@/components/Footer";
import { Link } from "@/i18n/routing";
import {
    getVaultCatalog,
    getVaultOffers,
    shouldRevealUpcoming,
    pickLocale,
    pickFlagship,
} from "@/app/lib/vault-catalog";
import { isEnabled } from "@/app/lib/env-flags";

const WHATSAPP_URL = "https://wa.me/13054131472";

/**
 * The public Vault sales page, at its own public address.
 *
 * It lives outside the member layout (which reads cookies via getViewer) so it
 * can be statically prerendered, and outside /vault so that it is the same
 * page for everyone — including Alejandra while she is signed in. An anonymous
 * visitor to /vault is redirected here by the proxy.
 *
 * Nothing here may read cookies or headers.
 */

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "VaultSales.meta" });

    return buildMetadata({
        locale,
        path: "/vault-access",
        title: t("title"),
        description: t("description"),
        // Unlisted until module video is real and Stripe is live. Flipping this
        // is a deliberate act behind an env flag, never a merge side-effect.
        // app/sitemap.ts is the other half and changes in the same commit.
        index: isEnabled(process.env.VAULT_INDEXABLE),
    });
}

export default async function VaultLandingPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: "VaultSales" });
    const tt = await getTranslations({ locale, namespace: "Testimonials" });

    const [catalog, offers] = await Promise.all([getVaultCatalog(), getVaultOffers()]);
    const reveal = shouldRevealUpcoming();
    const entries = reveal ? catalog : catalog.filter((e) => e.is_published);

    const flagship = pickFlagship(entries);

    const fullAccess = offers["full_access"];
    const singleCourse = entries.find((e) => e.is_published && e.price_display);

    // Course + FAQPage structured data, generated from exactly what renders so
    // the two cannot drift. Correct markup on a noindex page: nothing has to
    // change at flip time except the robots flag.
    const faqKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            ...entries
                .filter((e) => e.is_published)
                .map((e) => ({
                    "@type": "Course",
                    name: pickLocale(locale, e.title, e.title_es),
                    description: pickLocale(locale, e.description, e.description_es),
                    inLanguage: locale,
                    provider: {
                        "@type": "Organization",
                        name: "AC Styling",
                        url: "https://theacstyle.com",
                    },
                })),
            {
                "@type": "FAQPage",
                mainEntity: faqKeys.map((k) => ({
                    "@type": "Question",
                    name: t(`faq.q${k}`),
                    acceptedAnswer: { "@type": "Answer", text: t(`faq.a${k}`) },
                })),
            },
        ],
    };

    return (
        <>
            <Navbar />
            <main className="bg-ac-sand text-ac-taupe">
                {/* ── Hero ─────────────────────────────────────────────── */}
                <section id="vault-hero" className="relative min-h-[92vh] w-full overflow-hidden bg-black text-white">
                    <div className="absolute inset-0">
                        <div className="relative block h-full w-full md:hidden">
                            <Image
                                src="/ac photo 4.jpeg"
                                alt="Alejandra Carrillo, personal stylist"
                                fill
                                priority
                                sizes="100vw"
                                className="object-cover object-center"
                            />
                        </div>
                        {/* Eager, but deliberately NOT `priority`. next/image emits a
                            preload link for every priority image regardless of the CSS
                            that hides it, so marking both crops priority made every
                            phone download this desktop PNG as well — competing with the
                            image that is actually the LCP. Mobile is the majority path,
                            so it keeps the preload and this one just loads immediately. */}
                        <div className="relative hidden h-full w-full md:block">
                            <Image
                                src="/hero-manu.png"
                                alt="Alejandra Carrillo, personal stylist"
                                fill
                                loading="eager"
                                fetchPriority="high"
                                sizes="100vw"
                                className="object-cover object-center"
                            />
                        </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20 md:bg-gradient-to-r md:from-black/80 md:via-black/45 md:to-black/5" />
                    <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/65 to-transparent md:h-32" />

                    <div className="container relative z-10 mx-auto flex h-full min-h-[92vh] flex-col justify-end px-6 pb-24 md:justify-center md:px-12 md:pb-0">
                        <div className="max-w-xl">
                            <p className="mb-5 font-sans text-xs uppercase tracking-[0.3em] text-white/80">
                                {t("hero.eyebrow")}
                            </p>
                            <h1 className="font-serif text-4xl leading-[1.05] text-white md:text-6xl">
                                {t("hero.title")}
                            </h1>
                            <p className="mt-6 max-w-md text-lg font-light leading-relaxed text-white/85">
                                {t("hero.lede")}
                            </p>
                            <div className="mt-9 flex flex-wrap items-center gap-6">
                                <TrackedCta
                                    href="#offer"
                                    section="hero"
                                    target="anchor"
                                    className="bg-ac-sand px-8 py-4 text-xs font-bold uppercase tracking-widest text-ac-espresso transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-sand"
                                >
                                    {t("hero.ctaPrimary")}
                                </TrackedCta>
                                <TrackedCta
                                    href="#catalog"
                                    section="hero"
                                    target="anchor"
                                    className="border-b border-white/50 pb-1 text-sm text-white transition-colors hover:border-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-sand"
                                >
                                    {t("hero.ctaSecondary")}
                                </TrackedCta>
                            </div>
                        </div>
                    </div>
                </section>
                <Spine level={1} />

                {/* ── Rung 1 · Recognition ─────────────────────────────── */}
                <section className="px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-2xl">
                        <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                            {t("mirror.title")}
                        </h2>
                        <p className="mt-6 text-lg leading-relaxed text-ac-taupe">
                            {t("mirror.body")}
                        </p>
                        <p className="mt-6 font-serif text-2xl leading-snug text-ac-taupe md:text-[1.7rem]">
                            {t("mirror.close")}
                        </p>
                    </div>
                </section>
                <Spine level={2} />

                {/* ── Rung 2 · Explanation ─────────────────────────────── */}
                <section className="bg-ac-beige/30 px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-2xl">
                        <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                            {t("method.title")}
                        </h2>
                        <p className="mt-6 text-lg leading-relaxed text-ac-taupe">
                            {t("method.cognition")}
                        </p>
                        <p className="mt-5 text-lg leading-relaxed text-ac-taupe">
                            {t("method.thesis")}
                        </p>
                    </div>
                </section>
                <Spine level={3} />

                {/* ── Rung 3 · Placement: the path ─────────────────────── */}
                {/* One path in catalogue order: colour, body shape, style &
                    essence, closet. Colour used to be its own section, from
                    when Colorimetry was the only course; the other three were
                    bolted on after it. The colour field stays as the page's one
                    bold element, inside step 01. */}
                <section id="path" className="scroll-mt-24 px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-4xl">
                        <div className="mx-auto max-w-2xl">
                            <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                                {t("path.title")}
                            </h2>
                            <p className="mt-6 text-lg leading-relaxed text-ac-taupe">
                                {t("path.lede")}
                            </p>
                        </div>

                        <ol className="mt-14 space-y-16 md:space-y-20">
                            <li>
                                <div className="mx-auto max-w-2xl">
                                    <PathStepTitle n="01">{t("path.colourTitle")}</PathStepTitle>
                                    <p className="mt-3 text-lg leading-relaxed text-ac-taupe">
                                        {t("path.colourBody")}
                                    </p>
                                </div>
                                <div className="mt-10">
                                    <ColorField label={t("path.fieldAlt")} />
                                </div>
                                <p className="mx-auto mt-8 max-w-2xl leading-relaxed text-ac-taupe/85">
                                    {t("path.splitNote")}
                                </p>
                            </li>

                            <li className="mx-auto max-w-2xl">
                                <PathStepTitle n="02">{t("path.shapeTitle")}</PathStepTitle>
                                <p className="mt-3 text-lg leading-relaxed text-ac-taupe">
                                    {t("path.shapeBody")}
                                </p>
                            </li>

                            {/* The essence is the point of the method, so it carries
                                the page's accent rule. */}
                            <li className="mx-auto max-w-2xl border-l-2 border-ac-olive/50 pl-5">
                                <PathStepTitle n="03">{t("path.essenceTitle")}</PathStepTitle>
                                <p className="mt-3 font-serif text-2xl leading-snug text-ac-taupe md:text-[1.7rem]">
                                    {t("path.essenceBody")}
                                </p>
                            </li>

                            <li className="mx-auto max-w-2xl">
                                <PathStepTitle n="04">{t("path.closetTitle")}</PathStepTitle>
                                <p className="mt-3 text-lg leading-relaxed text-ac-taupe">
                                    {t("path.closetBody")}
                                </p>
                            </li>
                        </ol>
                    </div>
                </section>

                {/* ── Rung 4 · Method: the catalogue ───────────────────── */}
                <section id="catalog" className="scroll-mt-24 bg-ac-beige/30 px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-5xl">
                        <div className="max-w-2xl">
                            <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                                {t("catalog.title")}
                            </h2>
                            <p className="mt-4 text-lg leading-relaxed text-ac-taupe">
                                {t("catalog.lede")}
                            </p>
                        </div>

                        {entries.length === 0 ? (
                            <p className="mt-12 text-ac-taupe">{t("catalog.empty")}</p>
                        ) : (
                            <div
                                className={
                                    // One published course should not sit stranded in a
                                    // third of a three-column grid. The grid grows with
                                    // the catalogue instead of assuming it is full.
                                    entries.length === 1
                                        ? "mt-12 grid max-w-md gap-6"
                                        : entries.length === 2
                                          ? "mt-12 grid gap-6 sm:grid-cols-2"
                                          : "mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                                }
                            >
                                {entries.map((entry) => (
                                    <CatalogCard
                                        key={entry.id}
                                        entry={entry}
                                        locale={locale}
                                        t={{
                                            modulesLabel: t("catalog.modulesLabel"),
                                            // `t.raw` on purpose for the two strings the card
                                            // substitutes itself: they carry `{hours}` and `{date}`
                                            // placeholders that CatalogCard fills with a locale-formatted
                                            // value, so calling `t()` here asks next-intl to format a
                                            // variable it was never given. That threw a FORMATTING_ERROR
                                            // on every render of this page and only looked fine because
                                            // the fallback happens to return the raw message — the exact
                                            // string the card needs. `t.raw` asks for it deliberately.
                                            runtimeApprox: t.raw("catalog.runtimeApprox"),
                                            includedBadge: t("catalog.includedBadge"),
                                            inProductionBadge: t("catalog.inProductionBadge"),
                                            inProductionNote: t("catalog.inProductionNote"),
                                            availableOn: t.raw("catalog.availableOn"),
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
                <Spine level={4} />

                {/* ── Flagship curriculum ──────────────────────────────── */}
                {flagship && (
                    <section id="flagship" className="scroll-mt-24 px-6 py-20 md:py-28">
                        <div className="mx-auto max-w-3xl">
                            <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                                {t("flagship.title", {
                                    course:
                                        pickLocale(locale, flagship.title, flagship.title_es) ??
                                        flagship.title,
                                })}
                            </h2>
                            <p className="mt-4 text-lg leading-relaxed text-ac-taupe">
                                {t("flagship.lede", { count: flagship.modules.length })}
                            </p>
                            <FlagshipCurriculum
                                entry={flagship}
                                locale={locale}
                                takeawaysLabel={t("flagship.takeawaysLabel")}
                            />
                        </div>
                    </section>
                )}

                {/* ── What's included ──────────────────────────────────── */}
                <section className="bg-ac-beige/30 px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-3xl">
                        <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                            {t("included.title")}
                        </h2>
                        <dl className="mt-8 border-t border-ac-taupe/15">
                            {(["lifetime", "order", "devices", "languages", "support"] as const).map(
                                (k) => (
                                    <div key={k} className="border-b border-ac-taupe/15 py-4">
                                        <dd className="text-lg leading-relaxed text-ac-taupe">
                                            {t(`included.${k}`)}
                                        </dd>
                                    </div>
                                )
                            )}
                        </dl>
                        <p className="mt-6 max-w-xl text-ac-taupe">
                            {t("included.foundingNote")}
                        </p>
                    </div>
                </section>

                {/* ── Alejandra ────────────────────────────────────────── */}
                <section className="px-6 py-20 md:py-28">
                    <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[minmax(0,320px)_1fr] md:gap-14">
                        <div className="relative aspect-[3/4] w-full max-w-[320px] overflow-hidden">
                            <Image
                                src="/ac photo 2.jpg"
                                alt="Alejandra Carrillo"
                                fill
                                sizes="(max-width: 768px) 100vw, 320px"
                                className="object-cover object-top"
                            />
                        </div>
                        <div className="self-center">
                            <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                                {t("alejandra.name")}
                            </h2>
                            <p className="mt-2 text-sm uppercase tracking-widest text-ac-taupe">
                                {t("alejandra.role")}
                            </p>
                            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ac-taupe">
                                {t("alejandra.body")}
                            </p>
                        </div>
                    </div>
                </section>

                <TrustedBy />

                {/* ── Proof ────────────────────────────────────────────── */}
                <section className="px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-4xl">
                        <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                            {t("proof.title")}
                        </h2>
                        {/* Two real, named testimonials as text — not a carousel, which
                            would be machinery pretending to be volume, and not images,
                            which are unreadable to search and to screen readers. */}
                        <div className="mt-10 grid gap-10 md:grid-cols-2">
                            {[
                                { key: "t1", name: "Alexandra", place: "Toronto" },
                                { key: "t2", name: "Bianca", place: "Caracas" },
                            ].map((q) => (
                                <figure key={q.key}>
                                    <blockquote className="font-serif text-xl leading-relaxed text-ac-taupe md:text-[1.35rem]">
                                        {tt(`${q.key}.text`)}
                                    </blockquote>
                                    <figcaption className="mt-4 text-sm uppercase tracking-widest text-ac-taupe">
                                        {q.name} · {q.place}
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Offer ────────────────────────────────────────────── */}
                <section id="offer" className="scroll-mt-24 bg-ac-espresso px-6 py-20 text-ac-sand md:py-28">
                    <div className="mx-auto max-w-4xl">
                        <h2 className="font-serif text-3xl leading-tight text-ac-sand md:text-4xl">
                            {t("offer.title")}
                        </h2>

                        <div className="mt-10 grid gap-px bg-ac-sand/20 md:grid-cols-2">
                            <div className="flex flex-col bg-ac-espresso p-7">
                                <h3 className="font-serif text-2xl text-ac-sand">
                                    {fullAccess
                                        ? pickLocale(locale, fullAccess.title, fullAccess.title_es)
                                        : t("offer.fullTitle")}
                                </h3>
                                {fullAccess?.price_display && (
                                    <p className="mt-3 font-serif text-4xl text-ac-sand">
                                        {fullAccess.price_display}
                                    </p>
                                )}
                                <p className="mt-4 leading-relaxed text-ac-sand/75">
                                    {t("offer.fullBody")}
                                </p>
                                <div className="mt-7 pt-1">
                                    {/* isSignedIn is false by construction: the proxy
                                        only rewrites anonymous visitors here, so a
                                        member never sees this page. */}
                                    <VaultCheckoutButton
                                        priceId={fullAccess?.price_id ?? null}
                                        isSignedIn={false}
                                        section="offer_full"
                                        label={t("offer.fullCta")}
                                        unavailableLabel={t("offer.unavailable")}
                                        className="inline-block bg-ac-sand px-7 py-4 text-xs font-bold uppercase tracking-widest text-ac-espresso transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-sand"
                                    />
                                </div>
                            </div>

                            {singleCourse && (
                                <div className="flex flex-col bg-ac-espresso p-7">
                                    <h3 className="font-serif text-2xl text-ac-sand/90">
                                        {t("offer.singleTitle")}
                                    </h3>
                                    <p className="mt-3 font-serif text-4xl text-ac-sand/90">
                                        {singleCourse.price_display}
                                    </p>
                                    <p className="mt-4 leading-relaxed text-ac-sand/75">
                                        {t("offer.singleBody")}
                                    </p>
                                    <div className="mt-7 pt-1">
                                        <VaultCheckoutButton
                                            priceId={singleCourse.price_id}
                                            isSignedIn={false}
                                            section="offer_single"
                                            label={t("offer.singleCta")}
                                            unavailableLabel={t("offer.unavailable")}
                                            className="inline-block border border-ac-sand/50 px-7 py-4 text-xs font-bold uppercase tracking-widest text-ac-sand transition-colors hover:border-ac-sand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-sand"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="mt-8 text-xs uppercase tracking-widest text-ac-sand/75">
                            {t("offer.secure")}
                        </p>
                    </div>
                </section>

                {/* ── Bridge to 1:1 ────────────────────────────────────── */}
                <section className="px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-2xl">
                        <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                            {t("bridge.title")}
                        </h2>
                        <p className="mt-6 text-lg leading-relaxed text-ac-taupe">
                            {t("bridge.body")}
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                            <TrackedCta
                                href="/book"
                                internal
                                section="bridge"
                                target="calendly"
                                className="inline-block border border-ac-taupe/40 px-7 py-4 text-xs font-bold uppercase tracking-widest text-ac-taupe transition-colors hover:border-ac-taupe hover:bg-ac-taupe hover:text-ac-sand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-olive"
                            >
                                {t("bridge.cta")}
                            </TrackedCta>
                            <span className="text-ac-taupe">
                                {t("bridge.whatsappLead")}{" "}
                                <TrackedCta
                                    href={WHATSAPP_URL}
                                    external
                                    section="whatsapp"
                                    target="whatsapp"
                                    className="border-b border-ac-taupe/40 pb-0.5 text-ac-taupe transition-colors hover:border-ac-taupe focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-olive"
                                >
                                    {t("bridge.whatsappCta")}
                                </TrackedCta>
                            </span>
                        </div>
                    </div>
                </section>

                {/* ── FAQ ──────────────────────────────────────────────── */}
                <section className="bg-ac-beige/30 px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-3xl">
                        <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                            {t("faq.title")}
                        </h2>
                        <div className="mt-10 border-t border-ac-taupe/15">
                            {faqKeys.map((k) => (
                                <details key={k} className="group border-b border-ac-taupe/15">
                                    <summary className="flex cursor-pointer list-none items-baseline justify-between gap-5 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-olive">
                                        <span className="font-serif text-xl text-ac-taupe">
                                            {t(`faq.q${k}`)}
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className="mt-1 shrink-0 text-ac-taupe/40 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                                        >
                                            +
                                        </span>
                                    </summary>
                                    <div className="pb-6 pr-8">
                                        <p className="leading-relaxed text-ac-taupe">
                                            {t(`faq.a${k}`)}
                                            {k === "8" && (
                                                <>
                                                    {" "}
                                                    <Link
                                                        href="/legal/refunds"
                                                        className="border-b border-ac-taupe/40 pb-0.5 text-ac-taupe transition-colors hover:border-ac-taupe"
                                                    >
                                                        {t("faq.a8Link")}
                                                    </Link>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Closing ──────────────────────────────────────────── */}
                <section className="px-6 py-24 md:py-32">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="font-serif text-3xl leading-tight md:text-5xl">
                            {t("closing.title")}
                        </h2>
                        <p className="mt-4 font-serif text-2xl text-ac-taupe md:text-3xl">
                            {t("closing.body")}
                        </p>
                        <div className="mt-10">
                            <TrackedCta
                                href="/vault/join"
                                internal
                                section="closing"
                                target="checkout"
                                className="inline-block bg-ac-espresso px-9 py-4 text-xs font-bold uppercase tracking-widest text-ac-sand transition-colors hover:bg-ac-taupe focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-olive"
                            >
                                {t("closing.cta")}
                            </TrackedCta>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />

            <StickyCta
                label={t("sticky.label")}
                cta={t("sticky.cta")}
                price={fullAccess?.price_display ?? null}
                href="#offer"
            />

            <script
                type="application/ld+json"
                // Generated from the rendered content above, not hand-authored.
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
        </>
    );
}

/** A numbered step heading. The `<ol>` already gives the order to assistive tech, so the number is visual only. */
function PathStepTitle({ n, children }: { n: string; children: React.ReactNode }) {
    return (
        <h3 className="flex items-baseline gap-4 font-serif text-2xl text-ac-taupe">
            <span aria-hidden="true" className="font-sans text-xs tracking-[0.3em] text-ac-taupe/60">
                {n}
            </span>
            <span>{children}</span>
        </h3>
    );
}
