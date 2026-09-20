"use server";

import { requireAdmin } from '@/app/lib/auth-guards';
import { assertPublicUrl, assertSafeUrl } from '@/app/lib/ssrf-guard';

export async function extractUrlMetadata(url: string) {
    if (!url) return null;

    // Boutique/product scraping is an admin-only tool. Gate the caller and
    // block SSRF before navigating to a caller-supplied URL.
    const auth = await requireAdmin();
    if (!auth.ok) return null;

    try {
        await assertPublicUrl(url);
    } catch {
        return null;
    }

    // Helper to clean text
    const clean = (str: string | undefined | null) => str ? str.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ') : "";

    // Declared out here so the `finally` below can always close it. It used to
    // be closed only on the happy path, so a navigation timeout — the most
    // common failure for this tool — leaked a Chromium process every time.
    let browser: Awaited<ReturnType<typeof import('puppeteer-extra')['default']['launch']>> | null = null;

    try {
        // Lazy load Puppeteer to prevent bundle errors in Client Components
        const { default: puppeteer } = await import('puppeteer-extra');
        const { default: StealthPlugin } = await import('puppeteer-extra-plugin-stealth');

        puppeteer.use(StealthPlugin());

        browser = await puppeteer.launch({
            headless: true, // "new" is deprecated, true is current standard
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Validating the page URL says nothing about what the page then asks
        // for. Without this, a public page can pull in subresources pointed at
        // internal addresses and the browser fetches them for it (F07).
        //
        // The check here is the synchronous one: it catches literal private,
        // loopback, link-local and multicast addresses, and non-http schemes.
        // Resolving DNS for every subrequest would stall page loads, and this
        // tool is admin-gated, so that trade is deliberate and noted.
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            try {
                assertSafeUrl(request.url());
                void request.continue();
            } catch {
                void request.abort();
            }
        });

        // Go to URL and wait for meaningful content
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Extract metadata using page evaluation (runs in browser context)
        const metadata = await page.evaluate(() => {
            const getMeta = (props: string[]) => {
                for (const prop of props) {
                    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
                    if (el) return el.getAttribute('content');
                }
                return null;
            };

            const title =
                getMeta(['og:title', 'twitter:title', 'title']) ||
                document.title ||
                document.querySelector('h1')?.innerText;

            // Strategy: Gather ALL valid images
            const images = new Set<string>();

            // 1. OG Image (High priority default)
            const ogImage = getMeta(['og:image', 'twitter:image', 'image']);
            if (ogImage) images.add(ogImage);

            // 2. Schema.org (JSON-LD) - Gold standard for e-commerce
            try {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                scripts.forEach(script => {
                    try {
                        const json = JSON.parse(script.innerHTML);
                        // Access JSON-LD nodes
                        const items = Array.isArray(json) ? json : [json];
                        items.forEach(item => {
                            if (item.image) {
                                if (Array.isArray(item.image)) {
                                    item.image.forEach((img: string) => images.add(img));
                                } else if (typeof item.image === 'string') {
                                    images.add(item.image);
                                } else if (item.image.url) {
                                    images.add(item.image.url);
                                }
                            }
                        });
                    } catch (e) { }
                });
            } catch (e) { }

            // 3. Fallbacks
            const linkImg = document.querySelector<HTMLElement>('link[rel="image_src"]')?.getAttribute('href');
            if (linkImg) images.add(linkImg);

            // Return array
            return {
                title,
                images: Array.from(images),
                description: getMeta(['og:description', 'twitter:description', 'description']),
                siteName: getMeta(['og:site_name', 'site_name'])
            };
        });

        // Clean and validate
        return {
            title: clean(metadata.title),
            images: metadata.images, // Pass full array
            image: metadata.images[0] || "", // Default to first
            description: clean(metadata.description),
            siteName: clean(metadata.siteName)
        };

    } catch (error) {
        console.error("Puppeteer Extraction Error:", error);
        return null;
    } finally {
        if (browser) {
            // Never let a cleanup failure mask the real outcome.
            await browser.close().catch((closeErr) => {
                console.error("Puppeteer close failed:", closeErr);
            });
        }
    }
}
