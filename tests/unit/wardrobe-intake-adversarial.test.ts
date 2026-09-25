/**
 * Hostile tests for the tokenized Studio intake (app/actions/wardrobes.ts).
 *
 * An intake link is a bearer credential: whoever holds it can call these
 * actions directly, in any order, as often as they like, with any arguments.
 * The UI's upload flow (getSignedUploadUrl, then createWardrobeItem) is only
 * one of the sequences such a holder can send.
 *
 * Storage and RLS boundaries are in tests/integration/wardrobe-storage.test.ts;
 * these run as the service role, so the only guards are the ones in the code.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_ITEMS_PER_WARDROBE } from '@/app/lib/wardrobe-tokens'

type Wardrobe = { id: string; owner_id: string | null; status: string; upload_token: string; upload_token_expires_at: string | null }

const db = vi.hoisted(() => ({
    wardrobes: [] as Wardrobe[],
    items: [] as Record<string, unknown>[],
    objects: new Set<string>(),
}))

/** Just enough of the query builder for these actions, over the state above. */
function table(name: string) {
    const filters: [string, unknown][] = []
    let countOnly = false
    const matches = <T extends Record<string, unknown>>(rows: T[]) => rows.filter(r => filters.every(([k, v]) => r[k] === v))
    const q = {
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => { countOnly = !!opts?.head; return q },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q },
        single: async () => {
            const found = matches(db.wardrobes as unknown as Record<string, unknown>[])
            return found.length === 1 ? { data: found[0], error: null } : { data: null, error: { message: 'not found' } }
        },
        insert: async (row: Record<string, unknown>) => { db.items.push(row); return { error: null } },
        then: (resolve: (v: unknown) => unknown) => {
            if (name === 'wardrobe_items' && countOnly) return resolve({ count: matches(db.items).length, error: null })
            return resolve({ data: null, error: null })
        },
    }
    return q
}

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: () => ({
        from: table,
        storage: {
            from: () => ({
                list: async (folder: string, { search }: { search: string }) =>
                    ({ data: db.objects.has(`${folder}/${search}`) ? [{ name: search }] : [], error: null }),
                getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.invalid/${path}` } }),
                createSignedUploadUrl: async () => ({ data: { signedUrl: 'https://signed.invalid' }, error: null }),
                upload: async (path: string) => { db.objects.add(path); return { error: null } },
            }),
        },
    }),
}))

import { createWardrobeItem, getSignedUploadUrl } from '@/app/actions/wardrobes'

const future = new Date(Date.now() + 86_400_000).toISOString()
const past = new Date(Date.now() - 1000).toISOString()

function guestWardrobe(overrides: Partial<Wardrobe> = {}): Wardrobe {
    const w = { id: 'w-guest', owner_id: null, status: 'active', upload_token: 'tok', upload_token_expires_at: future, ...overrides }
    db.wardrobes.push(w)
    return w
}

function fill(wardrobeId: string, n: number) {
    for (let i = 0; i < n; i++) db.items.push({ wardrobe_id: wardrobeId })
}

beforeEach(() => {
    db.wardrobes.length = 0
    db.items.length = 0
    db.objects.clear()
})

describe('The item cap', () => {
    it('refuses a new upload URL once the wardrobe is full (control)', async () => {
        const w = guestWardrobe()
        fill(w.id, MAX_ITEMS_PER_WARDROBE)
        expect((await getSignedUploadUrl('tok', 'x.jpg')).success).toBe(false)
    })

    // The cap used to be checked only when a URL was minted, never when an
    // item was created: one uploaded object and a replayed createWardrobeItem
    // was all it took.
    it('refuses to create items past the cap by replaying one upload', async () => {
        const w = guestWardrobe()
        fill(w.id, MAX_ITEMS_PER_WARDROBE - 1)
        const path = `wardrobe/${w.id}/one.jpg`
        db.objects.add(path)

        const results = []
        for (let i = 0; i < 5; i++) results.push((await createWardrobeItem('tok', path, 'tops', '')).success)
        expect(db.items.filter(r => r.wardrobe_id === w.id)).toHaveLength(MAX_ITEMS_PER_WARDROBE)
        expect(results.filter(Boolean)).toHaveLength(1)
    })
})

describe('Tokens', () => {
    it.each([
        ['an expired token', { upload_token_expires_at: past }],
        ['an archived wardrobe', { status: 'archived' }],
    ])('refuses both steps for %s', async (_label, overrides) => {
        const w = guestWardrobe(overrides)
        db.objects.add(`wardrobe/${w.id}/a.jpg`)
        expect((await getSignedUploadUrl('tok', 'a.jpg')).success).toBe(false)
        expect((await createWardrobeItem('tok', `wardrobe/${w.id}/a.jpg`, '', '')).success).toBe(false)
        expect(db.items).toHaveLength(0)
    })

    it('refuses a token whose wardrobe was deleted', async () => {
        const w = guestWardrobe()
        db.objects.add(`wardrobe/${w.id}/a.jpg`)
        db.wardrobes.length = 0
        expect((await createWardrobeItem('tok', `wardrobe/${w.id}/a.jpg`, '', '')).success).toBe(false)
    })

    it('refuses to finish an upload with a token rotated after the URL was issued', async () => {
        const w = guestWardrobe()
        const { filePath } = await getSignedUploadUrl('tok', 'a.jpg')
        db.objects.add(filePath!)
        w.upload_token = 'rotated'
        expect((await createWardrobeItem('tok', filePath!, '', '')).success).toBe(false)
        expect((await createWardrobeItem('rotated', filePath!, '', '')).success).toBe(true)
    })
})

describe('Paths a token holder can point an item at', () => {
    it.each([
        ['another wardrobe’s intake', 'wardrobe/w-other/a.jpg'],
        ['a sibling id that shares a prefix', 'wardrobe/w-guestx/a.jpg'],
        ['a traversal out of the folder', 'wardrobe/w-guest/../w-other/a.jpg'],
        ['the folder itself', 'wardrobe/w-guest/'],
        ['a user folder, for an ownerless wardrobe', 'someone/a.jpg'],
        ['an absolute path', '/wardrobe/w-guest/a.jpg'],
    ])('refuses %s', async (_label, path) => {
        guestWardrobe()
        db.objects.add(path)
        expect((await createWardrobeItem('tok', path, '', '')).success).toBe(false)
        expect(db.items).toHaveLength(0)
    })

    it('refuses a path whose object was never uploaded', async () => {
        guestWardrobe()
        expect((await createWardrobeItem('tok', 'wardrobe/w-guest/ghost.jpg', '', '')).success).toBe(false)
    })

    it('accepts the owner’s own folder for an owned wardrobe (control)', async () => {
        guestWardrobe({ owner_id: 'owner-1' })
        db.objects.add('owner-1/a.jpg')
        expect((await createWardrobeItem('tok', 'owner-1/a.jpg', '', '')).success).toBe(true)
    })
})
