import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],
  // Increase Server Action body size limit for photo uploads (default is 1MB)
  serverActions: {
    bodySizeLimit: '15mb',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vitrtidtvkdoghcwgxjl.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
