/**
 * SSRF: address coverage and redirect re-validation (F07).
 *
 * The four entries marked "was ALLOWED" below were measured against the
 * previous guard, not imagined. The IPv4-mapped IPv6 pair is the serious one:
 * the WHATWG URL parser normalises `[::ffff:127.0.0.1]` to `::ffff:7f00:1`,
 * which the old dotted-decimal-only regex could never match, so **loopback was
 * reachable**.
 *
 * The redirect tests cover the other half of the finding. Validating the URL a
 * caller supplies and then calling `fetch` protects nothing, because `fetch`
 * follows redirects by default: one 302 to 169.254.169.254 and the guard is
 * bypassed entirely.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { assertSafeUrl, isNonPublicAddress, safeFetch } from '@/app/lib/ssrf-guard'

describe('address classification', () => {
    const blocked = [
        ['169.254.169.254', 'cloud metadata'],
        ['127.0.0.1', 'loopback'],
        ['10.0.0.1', 'private'],
        ['192.168.1.1', 'private'],
        ['172.16.0.1', 'private'],
        ['100.64.0.1', 'CGNAT'],
        ['198.18.0.1', 'benchmarking'],
        ['224.0.0.1', 'multicast — was ALLOWED'],
        ['240.0.0.1', 'reserved — was ALLOWED'],
        ['255.255.255.255', 'broadcast — was ALLOWED'],
        ['::1', 'IPv6 loopback'],
        ['::', 'unspecified'],
        ['fe80::1', 'link-local'],
        ['febf::1', 'link-local upper bound'],
        ['fd00::1', 'unique local'],
        ['ff02::1', 'IPv6 multicast — was ALLOWED'],
        ['::ffff:127.0.0.1', 'IPv4-mapped, dotted — was ALLOWED'],
        ['::ffff:7f00:1', 'IPv4-mapped, hex — was ALLOWED'],
        ['::ffff:169.254.169.254', 'metadata via IPv4-mapped'],
        ['::127.0.0.1', 'IPv4-compatible'],
        ['64:ff9b::7f00:1', 'NAT64-embedded loopback'],
        ['2001:db8::1', 'documentation range'],
    ] as const

    it.each(blocked)('blocks %s (%s)', (ip) => {
        expect(isNonPublicAddress(ip)).toBe(true)
    })

    const allowed = ['1.1.1.1', '8.8.8.8', '151.101.1.140', '2606:4700::1111', '2a00:1450:4001:80b::200e']
    it.each(allowed)('still allows the public address %s', (ip) => {
        expect(isNonPublicAddress(ip)).toBe(false)
    })

    it('fails closed on an unparseable address', () => {
        expect(isNonPublicAddress('not:an:address:at:all:x:y:z')).toBe(true)
        expect(isNonPublicAddress('999.999.999.999')).toBe(true)
    })
})

describe('assertSafeUrl', () => {
    it('rejects non-http schemes', () => {
        expect(() => assertSafeUrl('ftp://example.com/')).toThrow()
        expect(() => assertSafeUrl('file:///etc/passwd')).toThrow()
        expect(() => assertSafeUrl('gopher://example.com/')).toThrow()
    })

    it('rejects localhost by name, including subdomains', () => {
        expect(() => assertSafeUrl('http://localhost/')).toThrow()
        expect(() => assertSafeUrl('http://app.localhost/')).toThrow()
    })

    it('rejects embedded credentials', () => {
        // A classic way to make a hostile URL read as a familiar one.
        expect(() => assertSafeUrl('http://example.com@169.254.169.254/')).toThrow()
        expect(() => assertSafeUrl('http://user:pw@example.com/')).toThrow()
    })

    it('accepts an ordinary public URL', () => {
        expect(assertSafeUrl('https://images.example.com/a.jpg').hostname).toBe('images.example.com')
    })
})

describe('safeFetch', () => {
    const realFetch = globalThis.fetch

    beforeEach(() => vi.clearAllMocks())
    afterEach(() => { globalThis.fetch = realFetch })

    const respond = (body: string, init: { status?: number; headers?: Record<string, string> } = {}) =>
        new Response(body, {
            status: init.status ?? 200,
            headers: { 'content-type': 'image/png', ...(init.headers ?? {}) },
        })

    it('refuses a redirect that points at an internal address', async () => {
        globalThis.fetch = vi.fn(async () =>
            new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
        ) as never

        // The whole point of F07: the first URL is fine, the second is not, and
        // the old code never looked at the second.
        await expect(safeFetch('https://example.com/a.png')).rejects.toThrow()
    })

    it('refuses a redirect to an IPv4-mapped loopback address', async () => {
        globalThis.fetch = vi.fn(async () =>
            new Response(null, { status: 302, headers: { location: 'http://[::ffff:127.0.0.1]/secret' } })
        ) as never

        await expect(safeFetch('https://example.com/a.png')).rejects.toThrow()
    })

    it('stops after the redirect budget rather than looping', async () => {
        globalThis.fetch = vi.fn(async () =>
            new Response(null, { status: 302, headers: { location: 'https://example.com/next' } })
        ) as never

        await expect(safeFetch('https://example.com/a.png', { maxRedirects: 2 }))
            .rejects.toThrow(/Too many redirects/)
    })

    it('rejects a redirect with no destination', async () => {
        globalThis.fetch = vi.fn(async () => new Response(null, { status: 302 })) as never

        await expect(safeFetch('https://example.com/a.png')).rejects.toThrow(/without a destination/)
    })

    it('enforces the content-type allowlist', async () => {
        globalThis.fetch = vi.fn(async () =>
            respond('{"secret":true}', { headers: { 'content-type': 'application/json' } })
        ) as never

        await expect(
            safeFetch('https://example.com/a.png', { allowedContentTypes: ['image/'] })
        ).rejects.toThrow(/Unexpected content type/)
    })

    it('refuses a body that exceeds the cap even when the header understates it', async () => {
        globalThis.fetch = vi.fn(async () =>
            respond('x'.repeat(5000), { headers: { 'content-type': 'image/png', 'content-length': '1' } })
        ) as never

        await expect(safeFetch('https://example.com/a.png', { maxBytes: 100 })).rejects.toThrow(/too large/i)
    })

    it('returns the body and the URL it ended up at', async () => {
        globalThis.fetch = vi.fn(async () => respond('PNGDATA')) as never

        const result = await safeFetch('https://example.com/a.png', { allowedContentTypes: ['image/'] })

        expect(new TextDecoder().decode(result.body)).toBe('PNGDATA')
        expect(result.contentType).toBe('image/png')
        expect(result.finalUrl).toBe('https://example.com/a.png')
    })

    it('does not let fetch follow redirects on its own', async () => {
        // Rest args rather than named-but-unused ones, which this repo's lint
        // flags even when underscore-prefixed.
        let seenInit: RequestInit | undefined
        globalThis.fetch = (async (...args: [unknown, RequestInit?]) => {
            seenInit = args[1]
            return respond('PNGDATA')
        }) as never

        await safeFetch('https://example.com/a.png')

        // `redirect: 'manual'` is what makes every hop visible to the guard.
        expect(seenInit?.redirect).toBe('manual')
    })
})
