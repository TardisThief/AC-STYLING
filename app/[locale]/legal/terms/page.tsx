import { setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/app/lib/seo';
import TermsEn from './TermsEn';
import TermsEs from './TermsEs';

export const generateMetadata = pageMetadata({ path: '/legal/terms', key: 'legalTerms' });

/**
 * The document itself lives in a per-locale component rather than in
 * `messages/*.json`: these are long-form documents whose structure (headings,
 * lists, inline links, anchor ids) is part of the text, and threading that
 * through message keys makes both the copy and the markup harder to review
 * than the prose is to read.
 */
export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);

    return locale === 'es' ? <TermsEs /> : <TermsEn />;
}
