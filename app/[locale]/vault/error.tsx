'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * Vault-scoped boundary.
 *
 * Without this, a failure in any Vault page bubbles to `app/[locale]/error.tsx`
 * and replaces the whole screen — the member loses the Vault chrome and the
 * navigation with it, which reads as "the Vault is gone" rather than "this page
 * did not load". Catching it here keeps `vault/layout.tsx` (and so the
 * concierge navbar) mounted, and the copy says what is actually true: their
 * progress and purchases are untouched, because a render error never wrote
 * anything.
 *
 * It sits on the sand background the rest of the Vault uses, not the inverted
 * taupe of the locale-wide boundary, because it renders inside that chrome.
 */
export default function VaultError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations('Errors');

    useEffect(() => {
        console.error('Unhandled error rendering a Vault route:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center text-center py-24">
            <h1 className="font-serif text-3xl md:text-4xl text-ac-taupe mb-4 text-balance">{t('vaultTitle')}</h1>
            <p className="font-sans text-ac-taupe/75 mb-8 max-w-lg text-pretty leading-relaxed">{t('vaultBody')}</p>

            <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                    type="button"
                    onClick={reset}
                    className="px-8 py-3 bg-ac-taupe text-ac-sand font-sans uppercase tracking-widest text-xs font-semibold rounded-sm hover:bg-ac-espresso transition-colors duration-300"
                >
                    {t('retry')}
                </button>
                <Link
                    href="/vault"
                    className="px-8 py-3 border border-ac-taupe/30 text-ac-taupe font-sans uppercase tracking-widest text-xs font-semibold rounded-sm hover:border-ac-taupe transition-colors duration-300"
                >
                    {t('vaultHome')}
                </Link>
            </div>

            {error.digest ? (
                <p className="font-sans text-xs text-ac-taupe/40 mt-8">
                    {t('digest')}: {error.digest}
                </p>
            ) : null}
        </div>
    );
}
