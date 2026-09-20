import { setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/app/lib/seo';
import JoinClient from './JoinClient';

export const generateMetadata = pageMetadata({ key: 'vaultJoin' });

/**
 * Server wrapper — the join form is a client component and cannot export
 * `generateMetadata` itself.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <JoinClient />;
}
