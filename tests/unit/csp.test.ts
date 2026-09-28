/**
 * The enforced Content-Security-Policy allows what the app loads, and no more
 * than it needs (lib/csp.mjs).
 *
 * Enforced since 2026-09-28. Until then it was Report-Only with no report
 * endpoint, so nothing it would have blocked was ever seen: the Vimeo
 * player's oEmbed lookup (every video) and any Supabase origin other than
 * *.supabase.co. The browser walk is tests/e2e/csp.spec.ts; this pins the
 * sources a page only reaches in production (a real video, the booking widget).
 */
import { describe, it, expect } from 'vitest'
import { buildCsp } from '@/lib/csp.mjs'

function directives(policy: string): Record<string, string[]> {
    return Object.fromEntries(
        policy.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
            const [name, ...sources] = d.split(/\s+/)
            return [name, sources]
        })
    )
}

const prod = directives(buildCsp({
    supabaseUrl: 'https://vitrtidtvkdoghcwgxjl.supabase.co',
    siteUrl: 'https://www.theacstyle.com',
}))

describe('the production policy', () => {
    it('lets the Vimeo player look a video up and embed it', () => {
        expect(prod['connect-src']).toContain('https://vimeo.com')
        expect(prod['frame-src']).toContain('https://player.vimeo.com')
    })

    it('lets the booking widget load its script and its frame', () => {
        expect(prod['script-src']).toContain('https://assets.calendly.com')
        expect(prod['frame-src']).toContain('https://calendly.com')
    })

    it('lets the browser talk to its own Supabase project', () => {
        expect(prod['connect-src']).toContain('https://vitrtidtvkdoghcwgxjl.supabase.co')
    })

    it('keeps the hardening: no eval, no plugins, no framing, https only', () => {
        expect(prod['script-src']).not.toContain("'unsafe-eval'")
        expect(prod['object-src']).toEqual(["'none'"])
        expect(prod['frame-ancestors']).toEqual(["'none'"])
        expect(prod['upgrade-insecure-requests']).toEqual([])
    })
})

describe('outside production', () => {
    it('allows eval only in development, where React and HMR need it', () => {
        expect(directives(buildCsp({ dev: true }))['script-src']).toContain("'unsafe-eval'")
    })

    it('reaches a local test database over http, and does not upgrade it to https', () => {
        const local = directives(buildCsp({ supabaseUrl: 'http://127.0.0.1:54321', siteUrl: 'http://localhost:3100' }))
        expect(local['connect-src']).toContain('http://127.0.0.1:54321')
        expect(local['img-src']).toContain('http://127.0.0.1:54321')
        expect(local['upgrade-insecure-requests']).toBeUndefined()
    })
})
