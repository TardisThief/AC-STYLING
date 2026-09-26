/**
 * Account deletion reaches every file that is hers (2026-09-25 external
 * assessment, DATA-001).
 *
 * deleteAccount listed one level of `<userId>/` in studio-wardrobe, at most
 * 1,000 entries. A file in a sub-folder, or past the 1,000th, outlived the
 * account, and so did everything in the avatars bucket, whose policy scopes
 * uploads to the same `<userId>/` folder.
 *
 * Storage lists folders as entries with a null id; it pages with
 * limit/offset. The stand-in below does both, per bucket.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { buckets, removed } = vi.hoisted(() => ({
    buckets: {} as Record<string, string[]>,
    removed: {} as Record<string, string[]>,
}))

function listing(bucket: string, prefix: string, limit: number, offset: number) {
    const inside = (buckets[bucket] ?? []).filter(p => p.startsWith(`${prefix}/`)).map(p => p.slice(prefix.length + 1))
    const entries = new Map<string, { name: string; id: string | null }>()
    for (const rest of inside) {
        const [head, ...tail] = rest.split('/')
        entries.set(head, { name: head, id: tail.length ? null : `id-${head}` })
    }
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(offset, offset + limit)
}

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }), signOut: vi.fn() },
    })),
}))

vi.mock('@/utils/supabase/admin-client', () => ({
    createSupabaseAdminClient: vi.fn(() => ({
        auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })) } },
        storage: {
            from: (bucket: string) => ({
                list: async (prefix: string, { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}) =>
                    ({ data: listing(bucket, prefix, limit, offset), error: null }),
                remove: async (paths: string[]) => {
                    removed[bucket] = [...(removed[bucket] ?? []), ...paths]
                    return { error: null }
                },
            }),
        },
    })),
}))

import { deleteAccount } from '@/app/actions/vault/account'

beforeEach(() => {
    for (const k of Object.keys(buckets)) delete buckets[k]
    for (const k of Object.keys(removed)) delete removed[k]
})

describe('deleteAccount storage cleanup', () => {
    it.fails('removes files in sub-folders of her folder', async () => {
        buckets['studio-wardrobe'] = ['user-1/a.jpg', 'user-1/lookbook-thumbs/thumb_1.jpg', 'user-2/theirs.jpg']

        await deleteAccount()

        expect(removed['studio-wardrobe']?.sort()).toEqual(['user-1/a.jpg', 'user-1/lookbook-thumbs/thumb_1.jpg'])
    })

    it.fails('removes every file, not the first thousand', async () => {
        buckets['studio-wardrobe'] = Array.from({ length: 1205 }, (_, i) => `user-1/${String(i).padStart(5, '0')}.jpg`)

        await deleteAccount()

        expect(removed['studio-wardrobe']).toHaveLength(1205)
    })

    it.fails('removes her avatar too', async () => {
        buckets['avatars'] = ['user-1/avatar.png', 'user-2/avatar.png']

        await deleteAccount()

        expect(removed['avatars']).toEqual(['user-1/avatar.png'])
    })

    it('never touches another user’s files', async () => {
        buckets['studio-wardrobe'] = ['user-1/a.jpg', 'user-10/b.jpg', 'user-2/c.jpg']

        await deleteAccount()

        expect(removed['studio-wardrobe']).toEqual(['user-1/a.jpg'])
    })
})
