import { Link } from "@/i18n/routing";
import Footer from "@/components/Footer";

export default function LegalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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
