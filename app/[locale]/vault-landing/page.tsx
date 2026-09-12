import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Navbar from "@/components/Navbar";
import Spine from "@/components/vault-sales/Spine";
import ColorField from "@/components/vault-sales/ColorField";
import CatalogCard from "@/components/vault-sales/CatalogCard";
import { getVaultCatalog, shouldRevealUpcoming } from "@/app/lib/vault-catalog";

/**
 * The public Vault sales page.
 *
 * Served at /vault: the proxy rewrites an anonymous visitor here, so the URL
 * they see is the canonical one while this route stays outside the member
 * layout and its cookie-reading `getViewer()`. That is what keeps the page
 * statically prerenderable — the whole reason it is a separate route rather
 * than a branch inside the Vault index.
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

    return {
        title: t("title"),
        description: t("description"),
        // Unlisted until module video is real and Stripe is live. Flipping this
        // is a deliberate act behind an env flag, never a merge side-effect.
        robots: { index: false, follow: false },
    };
}

export default async function VaultLandingPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: "VaultSales" });
    const catalog = await getVaultCatalog();
    const reveal = shouldRevealUpcoming();
    const entries = reveal ? catalog : catalog.filter((e) => e.is_published);

    return (
        <>
            <Navbar />
            <main className="bg-ac-sand text-ac-taupe">
                {/* ── Hero ─────────────────────────────────────────────── */}
                <section className="relative min-h-[92vh] w-full overflow-hidden bg-black text-white">
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
                        <div className="relative hidden h-full w-full md:block">
                            <Image
                                src="/hero-manu.png"
                                alt="Alejandra Carrillo, personal stylist"
                                fill
                                priority
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
                                <a
                                    href="#offer"
                                    className="bg-ac-sand px-8 py-4 text-xs font-bold uppercase tracking-widest text-ac-espresso transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-sand"
                                >
                                    {t("hero.ctaPrimary")}
                                </a>
                                <a
                                    href="#catalog"
                                    className="border-b border-white/50 pb-1 text-sm text-white transition-colors hover:border-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-sand"
                                >
                                    {t("hero.ctaSecondary")}
                                </a>
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
                        <p className="mt-6 text-lg leading-relaxed text-ac-taupe/85">
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
                        <p className="mt-6 text-lg leading-relaxed text-ac-taupe/85">
                            {t("method.cognition")}
                        </p>
                        <p className="mt-5 text-lg leading-relaxed text-ac-taupe/85">
                            {t("method.thesis")}
                        </p>
                    </div>
                </section>
                <Spine level={3} />

                {/* ── Rung 3 · Placement — the one bold element ─────────── */}
                <section className="px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-4xl">
                        <div className="mx-auto max-w-2xl">
                            <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                                {t("locate.title")}
                            </h2>
                            <p className="mt-6 text-lg leading-relaxed text-ac-taupe/85">
                                {t("locate.body")}
                            </p>
                        </div>

                        <div className="mt-12">
                            <ColorField label={t("locate.fieldAlt")} />
                        </div>

                        <div className="mx-auto mt-12 max-w-2xl border-l-2 border-ac-olive/50 pl-5">
                            <h3 className="font-serif text-2xl text-ac-taupe">
                                {t("locate.splitTitle")}
                            </h3>
                            <p className="mt-3 leading-relaxed text-ac-taupe/80">
                                {t("locate.splitBody")}
                            </p>
                        </div>
                    </div>
                </section>

                {/* ── Rung 4 · Method: the catalogue ───────────────────── */}
                <section id="catalog" className="scroll-mt-24 bg-ac-beige/30 px-6 py-20 md:py-28">
                    <div className="mx-auto max-w-5xl">
                        <div className="max-w-2xl">
                            <h2 className="font-serif text-3xl leading-tight md:text-4xl">
                                {t("catalog.title")}
                            </h2>
                            <p className="mt-4 text-lg leading-relaxed text-ac-taupe/80">
                                {t("catalog.lede")}
                            </p>
                        </div>

                        {entries.length === 0 ? (
                            <p className="mt-12 text-ac-taupe/70">{t("catalog.empty")}</p>
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
                                            runtimeApprox: t("catalog.runtimeApprox"),
                                            includedBadge: t("catalog.includedBadge"),
                                            inProductionBadge: t("catalog.inProductionBadge"),
                                            inProductionNote: t("catalog.inProductionNote"),
                                            availableOn: t("catalog.availableOn"),
                                            cardCta: t("catalog.cardCta"),
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
                <Spine level={4} />

                {/* Remaining sections land in the next pass: flagship curriculum,
                    what's included, Alejandra, proof, offer, bridge, FAQ, close. */}
                <div id="offer" className="scroll-mt-24 px-6 py-20 text-center text-ac-taupe/40">
                    <p className="text-xs uppercase tracking-widest">In progress</p>
                </div>
            </main>
        </>
    );
}
