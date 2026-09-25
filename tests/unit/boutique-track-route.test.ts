/**
 * The public click-tracking redirect (app/api/boutique/track/route.ts),
 * attacked. It is reachable by anyone, signed in or not, with any query
 * string, and it both writes a row and redirects the browser.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
    item: null as Record<string, string | null> | null,
    clicks: [] as Record<string, unknown>[],
}))

vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
        from: (table: string) => {
            if (table === 'boutique_clicks') {
                return { insert: async (row: Record<string, unknown>) => { h.clicks.push(row); return { error: null } } }
            }
            const q = {
                select: () => q,
                eq: () => q,
                single: async () => (h.item ? { data: h.item, error: null } : { data: null, error: { message: 'not found' } }),
            }
            return q
        },
    }),
}))

import { GET } from '@/app/api/boutique/track/route'

const ITEM = '123e4567-e89b-12d3-a456-426614174000'
const call = (query: string) => GET(new NextRequest(`http://localhost/api/boutique/track?${query}`))

beforeEach(() => {
    h.clicks.length = 0
    h.item = { affiliate_url_usa: 'https://shop.invalid/usa', affiliate_url_es: 'https://shop.invalid/es' }
})

describe('boutique click redirect', () => {
    it('redirects to the locale’s affiliate URL and records the click (control)', async () => {
        const res = await call(`item_id=${ITEM}&locale=es`)
        expect(res.status).toBe(302)
        expect(res.headers.get('location')).toBe('https://shop.invalid/es')
        expect(h.clicks).toEqual([{ item_id: ITEM, user_id: null, locale: 'es' }])
    })

    it.fails.each(['javascript:alert(document.cookie)', 'data:text/html,<script>x</script>', 'vbscript:x', '//evil.invalid/x'])(
        'never redirects to a non-http(s) target: %s',
        async target => {
            h.item = { affiliate_url_usa: target, affiliate_url_es: null }
            const res = await call(`item_id=${ITEM}`)
            expect(res.status).not.toBe(302)
            expect(res.headers.get('location')).toBeNull()
        }
    )

    it.fails('does not store an arbitrary locale string in analytics', async () => {
        await call(`item_id=${ITEM}&locale=${'x'.repeat(10_000)}`)
        await call(`item_id=${ITEM}&locale=%3Cscript%3E`)
        for (const click of h.clicks) expect(['en', 'es']).toContain(click.locale)
    })

    it('refuses a missing item id without writing', async () => {
        expect((await call('locale=en')).status).toBe(400)
        expect(h.clicks).toHaveLength(0)
    })

    it('refuses an item that does not exist without writing', async () => {
        h.item = null
        expect((await call(`item_id=${ITEM}`)).status).toBe(404)
        expect(h.clicks).toHaveLength(0)
    })
})
