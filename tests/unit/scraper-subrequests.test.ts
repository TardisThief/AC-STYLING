// @vitest-environment node
/**
 * SEC-004 (2026-09-25 external assessment): the scraper's browser checked each
 * subrequest by its written address only.
 *
 * The page URL itself is DNS-checked (assertPublicUrl), but a public page can
 * pull in `<img src="http://metadata.attacker.example/...">`, a hostname whose
 * DNS answer is 169.254.169.254, and Chromium fetched it for us: the sync
 * check sees a harmless name. Now every subrequest host is resolved (once per
 * page, so pages still load quickly) and refused if any answer is non-public.
 *
 * Puppeteer and DNS are the only things replaced; the real action and the real
 * guard run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
    answers: {} as Record<string, string[]>,
    lookups: [] as string[],
    requests: [] as { url: string; outcome?: 'continue' | 'abort' }[],
    subrequests: [] as string[],
}))

vi.mock('dns', () => {
    const lookup = async (host: string) => {
        h.lookups.push(host)
        const addresses = h.answers[host]
        if (!addresses) throw Object.assign(new Error(`ENOTFOUND ${host}`), { code: 'ENOTFOUND' })
        return addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
    }
    return { default: { promises: { lookup } }, promises: { lookup } }
})

vi.mock('@/app/lib/auth-guards', () => ({ requireAdmin: async () => ({ ok: true }) }))
vi.mock('puppeteer-extra-plugin-stealth', () => ({ default: () => ({}) }))
vi.mock('puppeteer-extra', () => {
    let handler: ((r: unknown) => unknown) | null = null
    const page = {
        setRequestInterception: async () => {},
        on: (event: string, fn: (r: unknown) => unknown) => { if (event === 'request') handler = fn },
        // "Loading" the page: the browser asks for each subresource in turn.
        goto: async () => {
            for (const url of h.subrequests) {
                const record: { url: string; outcome?: 'continue' | 'abort' } = { url }
                h.requests.push(record)
                await handler!({
                    url: () => url,
                    continue: async () => { record.outcome = 'continue' },
                    abort: async () => { record.outcome = 'abort' },
                })
            }
            // As Puppeteer does, wait for every intercepted request to be
            // answered (the handler may decide asynchronously).
            for (let i = 0; i < 200 && h.requests.some((r) => !r.outcome); i++) {
                await new Promise((r) => setTimeout(r, 1))
            }
        },
        evaluate: async () => ({ title: 'A coat', description: '', images: [], price: null, currency: null, brand: null }),
    }
    return { default: { use: () => {}, launch: async () => ({ newPage: async () => page, close: async () => {} }) } }
})

import { extractUrlMetadata } from '@/app/actions/scraper'

const outcome = (url: string) => h.requests.find((r) => r.url === url)?.outcome

beforeEach(() => {
    h.lookups = []
    h.requests = []
    h.answers = {
        'shop.example': ['93.184.216.34'],
        'cdn.shop.example': ['93.184.216.35'],
        'metadata.attacker.example': ['169.254.169.254'],
        'intranet.attacker.example': ['10.0.0.5'],
        'mixed.attacker.example': ['93.184.216.36', '127.0.0.1'],
        'v6.attacker.example': ['::1'],
    }
})

describe('the scraper browser, per subrequest', () => {
    it('refuses a subresource whose hostname resolves to an internal address', async () => {
        h.subrequests = [
            'https://shop.example/product',
            'https://metadata.attacker.example/latest/meta-data/',
            'https://intranet.attacker.example/admin.png',
            'https://mixed.attacker.example/x.js',
            'https://v6.attacker.example/x.css',
        ]
        await extractUrlMetadata('https://shop.example/product')

        expect(outcome('https://metadata.attacker.example/latest/meta-data/')).toBe('abort')
        expect(outcome('https://intranet.attacker.example/admin.png')).toBe('abort')
        expect(outcome('https://mixed.attacker.example/x.js'), 'any private answer is enough').toBe('abort')
        expect(outcome('https://v6.attacker.example/x.css')).toBe('abort')
    })

    it('still loads the public page and its public subresources', async () => {
        h.subrequests = ['https://shop.example/product', 'https://cdn.shop.example/coat.jpg']
        const meta = await extractUrlMetadata('https://shop.example/product')

        expect(meta).not.toBeNull()
        expect(outcome('https://shop.example/product')).toBe('continue')
        expect(outcome('https://cdn.shop.example/coat.jpg')).toBe('continue')
    })

    it('refuses a host that does not resolve, and literal private addresses as before', async () => {
        h.subrequests = ['https://nowhere.invalid/a.png', 'http://127.0.0.1:8080/', 'http://[::ffff:7f00:1]/', 'file:///etc/passwd']
        await extractUrlMetadata('https://shop.example/product')
        for (const url of h.subrequests) expect(outcome(url), url).toBe('abort')
    })

    it('resolves each host once per page, however many requests it serves', async () => {
        h.subrequests = Array.from({ length: 20 }, (_, i) => `https://cdn.shop.example/img-${i}.jpg`)
        await extractUrlMetadata('https://shop.example/product')

        expect(h.requests.every((r) => r.outcome === 'continue')).toBe(true)
        expect(h.lookups.filter((host) => host === 'cdn.shop.example')).toHaveLength(1)
    })
})
