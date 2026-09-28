import createNextIntlPlugin from 'next-intl/plugin';
import { buildCsp } from './lib/csp.mjs';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The browser tests build into their own folder against a local database
  // (scripts/ci/run-e2e.mjs), so they never overwrite, or get mistaken for,
  // the production-configured build in .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],
  // Increase Server Action body size limit for photo uploads (default is 1MB).
  // On Next 16 this lives under `experimental` — at the top level it is ignored.
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vitrtidtvkdoghcwgxjl.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Signed URLs for the now-private studio-wardrobe bucket.
        protocol: 'https',
        hostname: 'vitrtidtvkdoghcwgxjl.supabase.co',
        port: '',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
  async redirects() {
    // /vault/gallery was a stale public marketing page: three hard-coded
    // masterclasses that did not exist, played against Vimeo's demo reel. It is
    // deleted, and its URL folds into the one canonical Vault address so that
    // Instagram links, SEO and anything handed out all land in the same place.
    // Config redirects run before the proxy, so this resolves before the
    // /vault auth check ever sees the request.
    return [
      {
        source: '/:locale(en|es)/vault/gallery',
        destination: '/:locale/vault',
        // 301 rather than Next's default 308 for `permanent: true`. Google
        // treats them the same; 301 is better understood by older crawlers.
        statusCode: 301,
      },
      {
        source: '/vault/gallery',
        destination: '/vault',
        statusCode: 301,
      },
      // /vault-landing was the internal rewrite target before the sales page
      // got its own public address. Anything that cached it folds forward.
      {
        source: '/:locale(en|es)/vault-landing',
        destination: '/:locale/vault-access',
        statusCode: 301,
      },
      {
        source: '/vault-landing',
        destination: '/vault-access',
        statusCode: 301,
      },
    ];
  },

  async headers() {
    // Enforced since 2026-09-28; what it allows, and why, is in lib/csp.mjs.
    const csp = buildCsp({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      dev: process.env.NODE_ENV !== 'production',
    });

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
