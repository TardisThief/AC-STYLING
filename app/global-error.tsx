'use client';

/**
 * The last-resort boundary: it catches errors thrown by the root layout
 * itself, which means it replaces that layout entirely and has to supply its
 * own `<html>` and `<body>`.
 *
 * Everything here is deliberately self-contained — inline styles, a system
 * font stack, no translations, no imports from the app. If this file renders,
 * the root layout did not, so the next-intl provider, the Google fonts and the
 * Tailwind layer are all things that may be exactly what failed. A pretty
 * error page that itself throws is worse than a plain one that does not.
 *
 * This is why the copy is English-only: `NextIntlClientProvider` lives in
 * `app/[locale]/layout.tsx`, below the layout that just failed, so there is no
 * locale and no message catalogue to read from at this point. The localized
 * boundary is `app/[locale]/error.tsx`, which catches everything short of this.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    padding: '0 1.5rem',
                    textAlign: 'center',
                    backgroundColor: '#5A4F44',
                    color: '#E6DED6',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                }}
            >
                <h1 style={{ fontSize: '2rem', fontWeight: 400, margin: 0 }}>Something came apart</h1>
                <p style={{ margin: 0, maxWidth: '32rem', lineHeight: 1.6, opacity: 0.85 }}>
                    An unexpected error stopped this page from loading. It is on our side, not yours.
                </p>
                <button
                    type="button"
                    onClick={reset}
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem 2rem',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: '#E6DED6',
                        color: '#5A4F44',
                        fontFamily: 'inherit',
                        fontSize: '0.875rem',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                    }}
                >
                    Try again
                </button>
                {/* The digest is the only handle support has on a specific
                    server-side failure; the message itself is withheld in
                    production, so without this there is nothing to quote. */}
                {error.digest ? (
                    <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5 }}>Reference: {error.digest}</p>
                ) : null}
            </body>
        </html>
    );
}
