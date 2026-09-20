import { setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/app/lib/seo';
import PrivacyEn from './PrivacyEn';
import PrivacyEs from './PrivacyEs';

export const generateMetadata = pageMetadata({ path: '/legal/privacy', key: 'legalPrivacy' });

/**
 * The document itself lives in a per-locale component rather than in
 * `messages/*.json`: these are long-form documents whose structure (headings,
 * lists, inline links, anchor ids) is part of the text, and threading that
 * through message keys makes both the copy and the markup harder to review
 * than the prose is to read.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);

    return locale === 'es' ? <PrivacyEs /> : <PrivacyEn />;
}
