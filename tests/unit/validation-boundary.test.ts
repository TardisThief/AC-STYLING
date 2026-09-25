/**
 * The validation boundary, attacked.
 *
 * CLAUDE.md: guard → parseInput(schema, input) → write ONLY parsed.data, never
 * a raw client object. A grep shows the rule is written down; this shows it
 * holds. A server action's arguments are whatever the caller POSTs — the
 * TypeScript types on them are not checked at runtime — so every admin write
 * is sent a valid payload plus keys the form never has: privilege columns,
 * row identity, audit timestamps, and an own-property `__proto__`. The object
 * that reaches insert/update/upsert must carry none of them.
 *
 * Both clients are captured: the RLS client requireAdmin returns, and the
 * service-role client, which RLS would not stop.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

const UUID = '123e4567-e89b-12d3-a456-426614174000'
const writes: { table: string; op: string; payload: unknown }[] = []

function capture(table: string) {
    const record = (op: string) => (payload: unknown) => { writes.push({ table, op, payload }); return q }
    const q: Record<string, unknown> = {
        insert: record('insert'),
        update: record('update'),
        upsert: record('upsert'),
        delete: () => q,
        select: () => q,
        eq: () => q,
        in: () => q,
        is: () => q,
        order: () => q,
        single: async () => ({ data: { id: UUID }, error: null }),
        maybeSingle: async () => ({ data: { id: UUID }, error: null }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [{ id: UUID }], error: null, count: 1 }),
    }
    return q
}

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: async () => ({ data: { user: { id: UUID } } }) },
        from: (table: string) => table === 'profiles'
            ? { select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'admin' }, error: null }) }) }) }
            : capture(table),
    })),
}))
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => ({ from: capture }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))

import { createBrand, updateBrand, createBoutiqueItem, updateBoutiqueItem, createCollection, updateCollection, createTrustedByLogo, updateTrustedByLogo } from '@/app/actions/admin/manage-boutique'
import { createBoutiqueItemsBatch } from '@/app/actions/admin/manage-boutique-upload'
import { upsertOffer } from '@/app/actions/admin/manage-offers'
import { upsertService } from '@/app/actions/admin/manage-services'
import { updateAdminWardrobeItem, updateWardrobe } from '@/app/actions/wardrobes'
import { brandSchema, boutiqueItemSchema, collectionSchema, trustedByLogoSchema, trustedByLogoUpdateSchema } from '@/app/lib/validation/boutique'
import { offerSchema } from '@/app/lib/validation/offers'
import { serviceSchema } from '@/app/lib/validation/services'
import { adminWardrobeItemUpdateSchema } from '@/app/lib/validation/wardrobe-items'
import { parseInput, resourceList } from '@/app/lib/validation/parse'
import { z as zod } from 'zod'

/** Keys the form never sends. Every one is a real column somewhere. */
function hostile<T extends object>(valid: T): Record<string, unknown> {
    return {
        ...valid,
        role: 'admin',
        has_full_unlock: true,
        access_expires_at: null,
        owner_id: '00000000-0000-4000-8000-00000000dead',
        upload_token: 'attacker-chosen',
        upload_token_expires_at: null,
        created_at: '1970-01-01T00:00:00Z',
        clicks: 1_000_000,
        constructor: 'x',
        // An OWN property named __proto__, as JSON.parse produces from a
        // POSTed body. A literal `__proto__:` here would set the prototype.
        ...JSON.parse('{"__proto__": {"polluted": true}}'),
    }
}

const INJECTED = ['role', 'has_full_unlock', 'access_expires_at', 'upload_token', 'upload_token_expires_at', 'created_at', 'clicks', 'constructor', '__proto__']

function shapeKeys(schema: z.ZodType): string[] {
    const s = schema as unknown as { shape?: object; in?: { shape?: object } }
    return Object.keys(s.shape ?? s.in?.shape ?? {})
}

function writtenKeys(): string[] {
    return writes.flatMap(w => (Array.isArray(w.payload) ? w.payload : [w.payload]).flatMap(p => Object.keys(p as object)))
}

const brand = { name: 'Brand' }
const item = { name: 'Item', image_url: 'https://img.invalid/a.jpg' }
const collection = { title: 'Edit' }
const logo = { name: 'Logo', logo_url: 'https://img.invalid/l.png' }
const offer = { slug: 'masterclass_pass', title: 'Pass' }
const service = { title: 'Session' }

beforeEach(() => { writes.length = 0 })

describe('Admin writes carry only schema columns', () => {
    // updateWardrobe has no schema yet; these are the columns its callers send.
    const wardrobeColumns = zod.object({ title: zod.string(), owner_id: zod.string(), status: zod.string() })
    const cases: [string, () => Promise<unknown>, z.ZodType, string[]][] = [
        ['createBrand', () => createBrand(hostile(brand)), brandSchema, []],
        ['updateBrand', () => updateBrand(UUID, hostile(brand)), brandSchema, ['updated_at']],
        ['createBoutiqueItem', () => createBoutiqueItem(hostile(item)), boutiqueItemSchema, []],
        ['updateBoutiqueItem', () => updateBoutiqueItem(UUID, hostile(item)), boutiqueItemSchema, ['updated_at']],
        ['createCollection', () => createCollection(hostile(collection)), collectionSchema, []],
        ['updateCollection', () => updateCollection(UUID, hostile(collection)), collectionSchema, ['updated_at']],
        ['createTrustedByLogo', () => createTrustedByLogo(hostile(logo) as never), trustedByLogoSchema, ['active']], // set server-side to true
        ['updateTrustedByLogo', () => updateTrustedByLogo(UUID, hostile({ active: false }) as never), trustedByLogoUpdateSchema, ['updated_at']],
        ['upsertOffer', () => upsertOffer(hostile(offer)), offerSchema, ['updated_at']],
        ['upsertService', () => upsertService(hostile(service)), serviceSchema, ['updated_at']],
        ['updateAdminWardrobeItem', () => updateAdminWardrobeItem(UUID, hostile({ status: 'Keep' })), adminWardrobeItemUpdateSchema, []],
    ]

    async function onlySchemaKeys(call: () => Promise<unknown>, schema: z.ZodType, extra: string[]) {
        await call()
        expect(writes.length, 'the action wrote something').toBeGreaterThan(0)
        const allowed = new Set([...shapeKeys(schema), ...extra])
        for (const key of writtenKeys()) expect(allowed, `wrote "${key}"`).toContain(key)
        for (const key of INJECTED) expect(writtenKeys()).not.toContain(key)
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    }

    it.each(cases)('%s writes nothing the schema does not define', (_name, call, schema, extra) =>
        onlySchemaKeys(call, schema, extra))

    // Both write a raw client object, with no parseInput at all.
    it.fails('updateWardrobe writes nothing the schema does not define', () =>
        onlySchemaKeys(() => updateWardrobe(UUID, hostile({ status: 'archived' }) as never), wardrobeColumns, ['updated_at']))

    it.fails('createBoutiqueItemsBatch writes nothing the schema does not define', () =>
        onlySchemaKeys(() => createBoutiqueItemsBatch([hostile(item)] as never), boutiqueItemSchema, []))
})

describe('parseInput at the edges', () => {
    it('coerces numeric strings the way a form sends them, and nothing looser', () => {
        expect(parseInput(collectionSchema, { title: 't', order_index: ' 5 ' })).toMatchObject({ ok: true, data: { order_index: 5 } })
        expect(parseInput(collectionSchema, { title: 't', order_index: '1e3' })).toMatchObject({ ok: true, data: { order_index: 1000 } })
        for (const bad of ['5.5', 'NaN', 'five', {}, [1, 2]]) {
            expect(parseInput(collectionSchema, { title: 't', order_index: bad }).ok, JSON.stringify(bad)).toBe(false)
        }
        // Known and accepted: z.coerce.number turns a boolean into 0/1. No form
        // sends one, the column is an ordering integer, and it cannot carry a key.
        expect(parseInput(collectionSchema, { title: 't', order_index: true })).toMatchObject({ ok: true, data: { order_index: 1 } })
    })

    it('treats a whitespace-only required field as missing', () => {
        expect(parseInput(brandSchema, { name: ' \t\n ' }).ok).toBe(false)
        expect(parseInput(brandSchema, { name: ' ' }).ok).toBe(false)
    })

    it('refuses wrong types instead of stringifying them into a column', () => {
        for (const bad of [{ toString: () => 'x' }, ['Brand'], 42, true, null]) {
            expect(parseInput(brandSchema, { name: bad }).ok, JSON.stringify(bad)).toBe(false)
        }
    })

    it('keeps an absent optional key absent, so a partial update never nulls a column it was not sent', () => {
        const partial = parseInput(offerSchema, { slug: 's', title: 't' })
        expect(partial.ok && Object.keys(partial.data)).not.toContain('description')
        const cleared = parseInput(offerSchema, { slug: 's', title: 't', description: null })
        expect(cleared.ok && cleared.data.description).toBeNull()
    })

    it('does not let an empty upsert id through as a real id', () => {
        const parsed = parseInput(offerSchema, { id: '', slug: 's', title: 't' })
        expect(parsed.ok && 'id' in parsed.data).toBe(false)
        expect(parseInput(offerSchema, { id: 'not-a-uuid', slug: 's', title: 't' }).ok).toBe(false)
    })

    it('refuses a non-http resource link, which would render as a clickable href', () => {
        const schema = zod.object({ resource_urls: resourceList('Resources') })
        for (const url of ['javascript:alert(1)', ' javascript:alert(1)', 'data:text/html,x', '//evil.invalid', 'JAVASCRIPT:alert(1)']) {
            expect(parseInput(schema, { resource_urls: [{ name: 'n', url }] }).ok, url).toBe(false)
        }
        expect(parseInput(schema, { resource_urls: [{ name: 'n', url: 'https://ok.invalid/a.pdf' }] }).ok).toBe(true)
    })
})
