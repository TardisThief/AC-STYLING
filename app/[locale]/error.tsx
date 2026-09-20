'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * The localized error boundary for everything under a locale.
 *
 * It renders inside `app/[locale]/layout.tsx`, so the next-intl provider is
 * above it and `useTranslations` works — unlike `app/global-error.tsx`, which
 * catches failures of that layout itself and therefore cannot translate
 * anything.
 */
export default function LocaleError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations('Errors');

    useEffect(() => {
        // Vercel captures console output; without this the digest is the only
        // trace and it is not always attributable to a page.
        console.error('Unhandled error rendering a locale route:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-ac-taupe text-ac-sand px-6 text-center">
            <h1 className="font-serif text-4xl md:text-6xl mb-4 text-ac-beige text-balance">{t('title')}</h1>
            <p className="font-sans text-lg md:text-xl mb-8 max-w-xl text-pretty opacity-90">{t('body')}</p>

            <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                    type="button"
                    onClick={reset}
                    className="px-8 py-3 bg-ac-beige text-ac-taupe font-sans uppercase tracking-widest text-sm font-semibold hover:bg-white transition-colors duration-300"
                >
                    {t('retry')}
                </button>
                <Link
                    href="/"
                    className="px-8 py-3 border border-ac-sand/40 font-sans uppercase tracking-widest text-sm font-semibold hover:border-ac-sand transition-colors duration-300"
                >
                    {t('home')}
                </Link>
            </div>

            {error.digest ? (
                <p className="font-sans text-xs opacity-50 mt-8">
                    {t('digest')}: {error.digest}
                </p>
            ) : null}
        </div>
    );
}
