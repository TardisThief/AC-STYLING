import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildMetadata, SITE_URL } from "@/app/lib/seo";
import Navbar from "@/components/Navbar";
import Spine from "@/components/vault-sales/Spine";
import CatalogCard from "@/components/vault-sales/CatalogCard";
import CatalogRail from "@/components/vault-sales/CatalogRail";
import Curriculum from "@/components/vault-sales/Curriculum";
import CurriculumDialog from "@/components/vault-sales/CurriculumDialog";
import TrackedCta from "@/components/vault-sales/TrackedCta";
import VaultCheckoutButton from "@/components/vault-sales/VaultCheckoutButton";
import GuestAccessLink from "@/components/vault-sales/GuestAccessLink";
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
    pickHeadlinePass,
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

    // The headline pass is whichever is on sale, decided in admin by
    // offers.active: Full Access once courses exist, the Masterclass Pass until
    // then. With neither active the Full Access copy stands and the button
    // reads "Available soon", as before.
    const passSlug = pickHeadlinePass(offers);
    const pass = offers[passSlug];

    // Every card on the page says "included with" the headline pass, so under
    // the Masterclass Pass a standalone course has no place here: it is not
    // included, and saying so on each card would be false.
    const entries = catalog.filter(
        (e) =>
            (reveal || e.is_published) &&
            (passSlug !== "masterclass_pass" || e.kind === "masterclass")
    );

    // Everything that can be bought on its own: published, priced, and with a
    // Stripe price to send her to. All three are required -- a card offering to
    // sell something we cannot charge for is worse than no card.
    const singles = entries.filter((e) => e.is_published && e.price_display && e.price_id);

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
                    // A reference to the Organization node the home page
                    // defines, not a second copy of it: same @id, one entity.
                    provider: { "@id": `${SITE_URL}/#organization` },
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
            {/* The landing page's About / Services / Contact don't exist here;
                the menu walks this page's own sections instead. */}
            <Navbar
                menuLabel={t("nav.menuLabel")}
                links={[
                    { name: t("nav.path"), href: "#path" },
                    { name: t("nav.catalog"), href: "#catalog" },
                    { name: t("nav.alejandra"), href: "#alejandra" },
                    { name: t("nav.offer"), href: "#offer" },
                    { name: t("nav.faq"), href: "#faq" },
                ]}
            />
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
                        {/* Three separate recognitions, so each one gets its own
                            beat to land. As a single paragraph they read as one
                            undifferentiated complaint. */}
                        <ul className="mt-6 list-none space-y-4">
                            {(["item1", "item2", "item3"] as const).map((k) => (
                                <li key={k} className="flex gap-4 text-lg leading-relaxed text-ac-taupe">
                                    <span aria-hidden="true" className="mt-3 h-px w-5 shrink-0 bg-ac-taupe/40" />
                                    <span>{t(`mirror.${k}`)}</span>
                                </li>
                            ))}
                        </ul>
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
                                {t(`pass.${passSlug}.catalogLede`)}
                            </p>
                        </div>

                        {entries.length === 0 ? (
                            <p className="mt-12 text-ac-taupe">{t("catalog.empty")}</p>
                        ) : (
                            // One row that scrolls sideways (and auto-advances when it
                            // overflows), not a grid: eight stacked cards made this the
                            // longest scroll on the page. With few enough cards to fit,
                            // it is simply a row with no controls.
                            <CatalogRail
                                label={t("catalog.railLabel")}
                                t={{
                                    previous: t("catalog.previous"),
                                    next: t("catalog.next"),
                                    pause: t("catalog.pause"),
                                    play: t("catalog.play"),
                                }}
                            >
                                {entries.map((entry) => {
                                    const entryTitle =
                                        pickLocale(locale, entry.title, entry.title_es) ?? entry.title;

                                    return (
                                    <CatalogCard
                                        key={entry.id}
                                        entry={entry}
                                        locale={locale}
                                        // In production as well as published: Body Shape's six
                                        // modules are written and real, and what is coming is
                                        // half of what the pass is for. The card already says
                                        // "In production", so nothing is misrepresented.
                                        curriculum={
                                            entry.modules.length > 0 ? (
                                                <CurriculumDialog
                                                    label={`${entry.modules.length} ${t("catalog.modulesLabel")}`}
                                                    openLabel={t("curriculum.open", { course: entryTitle })}
                                                    title={t("curriculum.title", { course: entryTitle })}
                                                >
                                                    <p className="text-lg leading-relaxed text-ac-taupe">
                                                        {t("curriculum.lede", { count: entry.modules.length })}
                                                    </p>
                                                    <Curriculum
                                                        entry={entry}
                                                        locale={locale}
                                                        takeawaysLabel={t("curriculum.takeawaysLabel")}
                                                    />
                                                </CurriculumDialog>
                                            ) : null
                                        }
                                        // Checkout is passed in rather than built by the card:
                                        // the card stays a server component that knows only
                                        // what the database told it.
                                        action={
                                            entry.is_published && entry.price_id ? (
                                                <VaultCheckoutButton
                                                    priceId={entry.price_id}
                                                    isSignedIn={false}
                                                    section="catalog_buy"
                                                    label={t("catalog.buyCta")}
                                                    unavailableLabel={t("offer.unavailable")}
                                                    className="inline-block border border-ac-taupe/40 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-ac-taupe transition-colors hover:border-ac-taupe hover:bg-ac-taupe hover:text-ac-sand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-olive"
                                                />
                                            ) : null
                                        }
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
                                            includedBadge: t(`pass.${passSlug}.includedBadge`),
                                            inProductionBadge: t("catalog.inProductionBadge"),
                                            inProductionNote: t("catalog.inProductionNote"),
                                            availableOn: t.raw("catalog.availableOn"),
                                        }}
                                    />
                                    );
                                })}
                            </CatalogRail>
                        )}
                    </div>
                </section>
                <Spine level={4} />

                {/* ── What's included ──────────────────────────────────── */}
                <section className="bg-ac-beige/30 px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-3xl">
                        <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                            {t("included.title")}
                        </h2>
                        <dl className="mt-8 border-t border-ac-taupe/15">
                            {(["term", "order", "devices", "languages", "support"] as const).map(
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
                        {/* The renewal arithmetic sits under the founding note
                            rather than in the list above: the note says her
                            renewal is priced from what she paid, and this is
                            the arithmetic for that sentence. In the list it was
                            a sixth thing to read; here it is the footnote to
                            the one line it explains. */}
                        <p className="mt-3 max-w-xl border-l-2 border-ac-taupe/20 pl-4 text-sm leading-relaxed text-ac-taupe/80">
                            {t("included.renewal")}
                        </p>
                    </div>
                </section>

                {/* ── Alejandra ────────────────────────────────────────── */}
                <section id="alejandra" className="scroll-mt-24 px-6 py-20 md:py-28">
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

                        <div className="mt-10 border border-ac-sand/20">
                            <div className="flex flex-col bg-ac-espresso p-7">
                                <h3 className="font-serif text-2xl text-ac-sand">
                                    {pass
                                        ? pickLocale(locale, pass.title, pass.title_es)
                                        : t(`pass.${passSlug}.name`)}
                                </h3>
                                {pass?.price_display && (
                                    <p className="mt-3 font-serif text-4xl text-ac-sand">
                                        {pass.price_display}
                                    </p>
                                )}
                                <p className="mt-4 leading-relaxed text-ac-sand/75">
                                    {t(`pass.${passSlug}.body`)}
                                </p>
                                <div className="mt-7 pt-1">
                                    {/* isSignedIn is false by construction: the proxy
                                        only rewrites anonymous visitors here, so a
                                        member never sees this page. */}
                                    <VaultCheckoutButton
                                        priceId={pass?.price_id ?? null}
                                        isSignedIn={false}
                                        section={passSlug === "masterclass_pass" ? "offer_masterclass_pass" : "offer_full"}
                                        label={t(`pass.${passSlug}.cta`)}
                                        unavailableLabel={t("offer.unavailable")}
                                        className="inline-block bg-ac-sand px-7 py-4 text-xs font-bold uppercase tracking-widest text-ac-espresso transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-sand"
                                    />
                                    {/* The secondary path: into the Vault as a guest,
                                        without paying. Deliberately quieter than the
                                        button above it. */}
                                    <div className="mt-4">
                                        <GuestAccessLink
                                            label={t("offer.guestCta")}
                                            loadingLabel={t("offer.guestLoading")}
                                            errorLabel={t("offer.guestError")}
                                            className="text-sm italic text-ac-sand/75 underline decoration-ac-sand/30 underline-offset-4 transition-colors hover:text-ac-sand hover:decoration-ac-sand disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-sand"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* The term and the ladder, said once in plain words. The
                            full rule lives in the terms; this is the version she
                            reads before paying. */}
                        <p className="mt-6 max-w-2xl leading-relaxed text-ac-sand/75">
                            {t("offer.renewalNote")}
                        </p>

                        {/* Buying one masterclass on its own. Driven entirely by
                            what is priced in the database -- the section that used
                            to live here named Colorimetry in fixed copy and could
                            never have sold anything else. */}
                        {singles.length > 0 && (
                            <div className="mt-14 border-t border-ac-sand/20 pt-10">
                                <h3 className="font-serif text-2xl text-ac-sand">
                                    {t("singles.title")}
                                </h3>
                                <p className="mt-3 max-w-2xl leading-relaxed text-ac-sand/75">
                                    {t("singles.lede")}
                                </p>
                                <ul className="mt-8 border-t border-ac-sand/15">
                                    {singles.map((entry) => {
                                        const title =
                                            pickLocale(locale, entry.title, entry.title_es) ?? entry.title;
                                        return (
                                            <li
                                                key={entry.id}
                                                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-ac-sand/15 py-5"
                                            >
                                                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                                                    <span className="font-serif text-xl text-ac-sand">{title}</span>
                                                    <span className="font-serif text-xl text-ac-sand/75">
                                                        {entry.price_display}
                                                    </span>
                                                </div>
                                                <VaultCheckoutButton
                                                    priceId={entry.price_id}
                                                    isSignedIn={false}
                                                    section="offer_single_masterclass"
                                                    label={t("singles.buy", { title })}
                                                    unavailableLabel={t("offer.unavailable")}
                                                    className="inline-block border border-ac-sand/50 px-6 py-3 text-xs font-bold uppercase tracking-widest text-ac-sand transition-colors hover:border-ac-sand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-sand"
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

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
                <section id="faq" className="scroll-mt-24 bg-ac-beige/30 px-6 py-20 md:py-28">
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
                label={t(`pass.${passSlug}.sticky`)}
                cta={t("sticky.cta")}
                price={pass?.price_display ?? null}
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
            {/* Sized to be read, not decoded: at text-xs/60% these were
                invisible on a phone. The wide tracking went with them — it was
                compensating for the small size. */}
            <span aria-hidden="true" className="font-serif text-2xl tabular-nums text-ac-taupe/80 md:text-3xl">
                {n}
            </span>
            <span>{children}</span>
        </h3>
    );
}
