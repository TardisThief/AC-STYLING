import { Link } from "@/i18n/routing";
import { setRequestLocale } from 'next-intl/server';
import Footer from "@/components/Footer";

// Needed here as well as in the root layout: this is a server layout that
// renders a locale-aware <Link>, and resolving the locale without an explicit
// setRequestLocale falls back to a dynamic API — which kept the legal pages,
// the most purely static content in the app, rendering per request.
export default async function LegalLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    return (
        <div className="min-h-screen bg-ac-sand flex flex-col text-ac-taupe">
            <header className="w-full py-8 flex justify-center border-b border-ac-taupe/10 bg-ac-sand">
                <Link
                    href="/"
                    className="font-serif text-2xl font-bold uppercase tracking-widest text-ac-taupe hover:text-ac-espresso transition-colors"
                >
                    AC Styling
                </Link>
            </header>
            <main className="flex-grow container mx-auto px-6 md:px-12 py-12 max-w-4xl">
                <div className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:text-ac-taupe prose-p:text-ac-taupe/80 prose-a:text-ac-espresso hover:prose-a:text-ac-taupe">
                    {children}
                </div>
            </main>
            <Footer />
        </div>
    );
}
