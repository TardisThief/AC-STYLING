import Hero from "@/components/Hero";
import TrustedBy from "@/components/TrustedBy";
import About from "@/components/About";
import Services from "@/components/Services";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";
import Contact from "@/components/Contact";
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { pageMetadata } from '@/app/lib/seo';
import { organizationJsonLd } from '@/app/lib/structured-data';

export const generateMetadata = pageMetadata({ path: '/', key: 'home' });

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);

    // The brand entity belongs on the root and only on the root. Its
    // description is the same localized string the page ships as its meta
    // description, so the two cannot describe the business differently.
    const t = await getTranslations({ locale, namespace: 'Meta' });
    const jsonLd = organizationJsonLd(locale, t('home.description'));

    return (
        <main className="flex min-h-screen flex-col items-center justify-between">
            <Hero />
            <TrustedBy />
            <div id="about" className="w-full"><About /></div>
            <div id="services" className="w-full"><Services /></div>
            <Testimonials />
            <Contact />
            <Footer />

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
        </main>
    );
}
