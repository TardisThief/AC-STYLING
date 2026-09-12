import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ClaimAccessForm from "@/components/vault-sales/ClaimAccessForm";
import { getPurchaseSession } from "@/app/actions/vault/claim-purchase";

/**
 * Where Stripe returns a buyer after a guest purchase.
 *
 * Previously checkout returned to the sales page itself, so someone who had
 * just paid landed back on the page selling her the thing she had bought, with
 * no acknowledgement. This is that acknowledgement, plus the fastest route in.
 *
 * Dynamic on purpose: it reads a Stripe session id from the query string and
 * verifies it server-side. Never indexed.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "VaultWelcome" });
    return {
        title: t("metaTitle"),
        robots: { index: false, follow: false },
    };
}

export default async function WelcomePage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ session_id?: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const { session_id: sessionId } = await searchParams;

    const t = await getTranslations({ locale, namespace: "VaultWelcome" });
    const info = sessionId ? await getPurchaseSession(sessionId) : null;

    return (
        <>
            <Navbar />
            <main className="bg-ac-sand text-ac-taupe">
                <section className="px-6 py-28 md:py-36">
                    <div className="mx-auto max-w-2xl">
                        {!info || !info.ok ? (
                            <>
                                <h1 className="font-serif text-3xl leading-tight md:text-4xl">
                                    {t("problemTitle")}
                                </h1>
                                <p className="mt-5 text-lg leading-relaxed text-ac-taupe">
                                    {info?.error ?? t("problemBody")}
                                </p>
                                <p className="mt-8">
                                    <Link
                                        href="/login"
                                        className="border-b border-ac-taupe/40 pb-0.5 text-ac-taupe transition-colors hover:border-ac-taupe"
                                    >
                                        {t("goToLogin")}
                                    </Link>
                                </p>
                            </>
                        ) : (
                            <>
                                <h1 className="font-serif text-3xl leading-tight md:text-4xl">
                                    {t("title")}
                                </h1>
                                <p className="mt-5 text-lg leading-relaxed text-ac-taupe">
                                    {t("paidTo", { email: info.email ?? "" })}
                                </p>

                                {info.pending && (
                                    <p className="mt-6 border-l-2 border-ac-olive-dark/50 pl-5 leading-relaxed text-ac-taupe">
                                        {t("stillSettingUp")}
                                    </p>
                                )}

                                {info.claimable && sessionId && (
                                    <>
                                        <h2 className="mt-12 font-serif text-2xl text-ac-taupe">
                                            {t("choosePassword")}
                                        </h2>
                                        <ClaimAccessForm
                                            sessionId={sessionId}
                                            t={{
                                                passwordLabel: t("passwordLabel"),
                                                passwordHint: t("passwordHint"),
                                                submit: t("submit"),
                                                working: t("working"),
                                                signedOutNote: t("signedOutNote"),
                                            }}
                                        />
                                    </>
                                )}

                                {info.claimable === false && (
                                    <p className="mt-8 leading-relaxed text-ac-taupe">
                                        {t("alreadyHasPassword")}{" "}
                                        <Link
                                            href="/login"
                                            className="border-b border-ac-taupe/40 pb-0.5 text-ac-taupe transition-colors hover:border-ac-taupe"
                                        >
                                            {t("goToLogin")}
                                        </Link>
                                    </p>
                                )}

                                <p className="mt-10 text-sm leading-relaxed text-ac-taupe">
                                    {t("emailFallback")}
                                </p>
                            </>
                        )}
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
