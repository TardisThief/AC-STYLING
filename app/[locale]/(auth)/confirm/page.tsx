import { setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/app/lib/seo';
import ConfirmClient from './ConfirmClient';

export const generateMetadata = pageMetadata({ key: 'authConfirm' });

/**
 * Server wrapper. The form itself is a client component; a client component
 * cannot export `generateMetadata`, which is why every auth route shipped the
 * locale layout's generic title until now.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <ConfirmClient />;
}
