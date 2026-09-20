import { getTranslations, setRequestLocale } from "next-intl/server";
import Footer from "@/components/Footer";
import { pageMetadata } from "@/app/lib/seo";
import CalendlyEmbed from "./CalendlyEmbed";

export const generateMetadata = pageMetadata({ path: "/book", key: "book" });

export default async function BookPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: "BookPage" });

    const expectations = [1, 2, 3].map((n) => ({
        title: t(`expect${n}Title`),
        body: t(`expect${n}Body`),
    }));
    const faqs = [1, 2, 3, 4].map((n) => ({
        q: t(`faq${n}Q`),
        a: t(`faq${n}A`),
    }));

    return (
        <main className="flex min-h-screen flex-col items-center bg-ac-sand">
            <section className="w-full max-w-3xl px-6 pt-28 pb-12 md:pt-36 text-center">
                <p className="font-sans uppercase tracking-[0.2em] text-xs text-ac-taupe/60 mb-4">
                    {t("eyebrow")}
                </p>
                <h1 className="font-serif text-4xl md:text-6xl leading-[1.05] text-ac-taupe text-balance mb-6">
                    {t("heading")}
                </h1>
                <p className="font-sans text-lg text-ac-taupe/80 leading-relaxed text-pretty">
                    {t("intro")}
                </p>
            </section>

            <section className="w-full max-w-5xl px-6 pb-16" aria-labelledby="book-expect">
                <h2 id="book-expect" className="font-serif text-2xl md:text-3xl text-ac-taupe text-center mb-8">
                    {t("expectTitle")}
                </h2>
                <ol className="grid gap-6 md:grid-cols-3">
                    {expectations.map((item, i) => (
                        <li
                            key={item.title}
                            className="bg-white/40 backdrop-blur-sm rounded-xl border border-ac-taupe/10 p-6"
                        >
                            <span className="font-serif text-3xl text-ac-taupe/30 block mb-3">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <h3 className="font-serif text-xl text-ac-taupe mb-2">{item.title}</h3>
                            <p className="font-sans text-sm text-ac-taupe/75 leading-relaxed">{item.body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="w-full max-w-4xl px-4 pb-16" aria-labelledby="book-scheduler">
                <h2
                    id="book-scheduler"
                    className="font-serif text-2xl md:text-3xl text-ac-taupe text-center mb-8"
                >
                    {t("schedulerTitle")}
                </h2>
                <CalendlyEmbed />
            </section>

            <section className="w-full max-w-3xl px-6 pb-24" aria-labelledby="book-faq">
                <h2 id="book-faq" className="font-serif text-2xl md:text-3xl text-ac-taupe text-center mb-8">
                    {t("faqTitle")}
                </h2>
                <dl className="divide-y divide-ac-taupe/10 border-y border-ac-taupe/10">
                    {faqs.map((faq) => (
                        <div key={faq.q} className="py-5">
                            <dt className="font-serif text-lg text-ac-taupe mb-1">{faq.q}</dt>
                            <dd className="font-sans text-sm text-ac-taupe/75 leading-relaxed">{faq.a}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <Footer />
        </main>
    );
}
