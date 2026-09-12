import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/**
 * Social card for the Vault, typeset rather than screenshotted.
 *
 * The season palette runs as a band across the foot — the same four anchors as
 * the colour field on the page, so a shared link carries the page's one
 * distinctive idea instead of a generic logo lockup.
 *
 * Antic Didone is fetched at render time because `next/og` cannot use the
 * project's `next/font` instance. Without it the card silently fell back to a
 * sans and every shared link went out in the wrong voice. The fetch is wrapped:
 * if Google Fonts is unreachable the card still renders, just in the fallback
 * face, because a slightly-off card beats a broken one.
 */

export const alt = 'The AC Styling Vault';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

async function loadDidone(): Promise<ArrayBuffer | null> {
    try {
        const css = await fetch(
            'https://fonts.googleapis.com/css2?family=Antic+Didone&display=swap',
            {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                next: { revalidate: 60 * 60 * 24 * 30 },
            }
        ).then((r) => r.text());

        const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
        if (!url) return null;

        return await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } }).then((r) =>
            r.arrayBuffer()
        );
    } catch {
        return null;
    }
}

export default async function Image({ params }: { params: { locale: string } }) {
    const { locale } = params;
    const t = await getTranslations({ locale, namespace: 'VaultSales' });
    const didone = await loadDidone();

    const SEASONS = ['#D8B65C', '#A96A3E', '#9FB0BE', '#4A4A6A'];

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    backgroundColor: '#E6DED6',
                }}
            >
                {/* Padding lives on the text block, not the root, so the season
                    band below can reach both edges without negative margins. */}
                <div style={{ display: 'flex', flexDirection: 'column', padding: '72px 80px 0' }}>
                    <div
                        style={{
                            fontSize: 22,
                            letterSpacing: 8,
                            textTransform: 'uppercase',
                            color: '#8C847B',
                            marginBottom: 34,
                        }}
                    >
                        AC Styling
                    </div>
                    <div
                        style={{
                            fontFamily: didone ? 'Antic Didone' : 'serif',
                            fontSize: 76,
                            lineHeight: 1.1,
                            color: '#3D3630',
                            maxWidth: 960,
                        }}
                    >
                        {t('hero.title')}
                    </div>
                    <div
                        style={{
                            fontSize: 29,
                            color: '#5A4F44',
                            marginTop: 32,
                            maxWidth: 820,
                            lineHeight: 1.4,
                        }}
                    >
                        {t('hero.lede')}
                    </div>
                </div>

                <div style={{ display: 'flex', width: '100%', height: 20 }}>
                    {SEASONS.map((c) => (
                        <div key={c} style={{ flex: 1, backgroundColor: c }} />
                    ))}
                </div>
            </div>
        ),
        {
            ...size,
            fonts: didone
                ? [{ name: 'Antic Didone', data: didone, style: 'normal', weight: 400 }]
                : undefined,
        }
    );
}
