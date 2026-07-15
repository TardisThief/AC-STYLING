/**
 * Stylist-private notes and bulk curation.
 *
 * The Studio's item panel labelled `notes` as "Ale's Private Note" while the
 * client view rendered that same column to the client. The private note now
 * lives in `internal_note`, which clients cannot reach: migration 08 revokes
 * column access from `authenticated`, and admin reads/writes go through the
 * service role. These tests pin the boundary and the guards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CLIENT_ITEM_COLUMNS } from '@/app/lib/wardrobe-columns'
import { adminWardrobeItemUpdateSchema, bulkStatusSchema } from '@/app/lib/validation/wardrobe-items'

const mockFrom = vi.fn()
vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
        storage: { from: vi.fn(() => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) })) },
    })),
}))

const mockRequireAdmin = vi.fn()
vi.mock('@/app/lib/auth-guards', () => ({
    requireAdmin: () => mockRequireAdmin(),
    requireUser: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: vi.fn() }, from: mockFrom })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))

import { getAdminWardrobeItems, updateAdminWardrobeItem, bulkSetItemStatus } from '@/app/actions/wardrobes'

const ITEM_ID = '11111111-1111-4111-8111-111111111111'
const WARDROBE_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ ok: true, supabase: { from: mockFrom }, user: { id: 'admin-1' } })
})

describe('the client-readable column list', () => {
    it('never exposes internal_note', () => {
        expect(CLIENT_ITEM_COLUMNS).not.toContain('internal_note')
    })

    it('still carries the columns the client view renders', () => {
        for (const col of ['image_url', 'category', 'client_note', 'notes', 'brand', 'status', 'tags']) {
            expect(CLIENT_ITEM_COLUMNS).toContain(col)
        }
    })

    it('does not smuggle internal_note in via the `notes` substring match', () => {
        // `notes` and `internal_note` overlap textually; assert on real boundaries.
        const cols = CLIENT_ITEM_COLUMNS.split(',').map(c => c.trim())
        expect(cols).toContain('notes')
        expect(cols).not.toContain('internal_note')
    })
})

describe('admin item actions are guarded', () => {
    it('getAdminWardrobeItems refuses a non-admin', async () => {
        mockRequireAdmin.mockResolvedValue({ ok: false, error: 'Forbidden' })
        const res = await getAdminWardrobeItems(WARDROBE_ID)
        expect(res.success).toBe(false)
        expect(res.error).toBe('Forbidden')
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it('updateAdminWardrobeItem refuses a non-admin', async () => {
        mockRequireAdmin.mockResolvedValue({ ok: false, error: 'Forbidden' })
        const res = await updateAdminWardrobeItem(ITEM_ID, { internal_note: 'private' })
        expect(res.success).toBe(false)
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it('bulkSetItemStatus refuses a non-admin', async () => {
        mockRequireAdmin.mockResolvedValue({ ok: false, error: 'Forbidden' })
        const res = await bulkSetItemStatus([ITEM_ID], 'Keep')
        expect(res.success).toBe(false)
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it('rejects a malformed wardrobe id before querying', async () => {
        const res = await getAdminWardrobeItems('not-a-uuid')
        expect(res.success).toBe(false)
        expect(mockFrom).not.toHaveBeenCalled()
    })
})

describe('admin update writes only validated fields', () => {
    it('drops keys outside the schema rather than spreading them into the row', async () => {
        const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
        mockFrom.mockReturnValue({ update })

        await updateAdminWardrobeItem(ITEM_ID, {
            internal_note: 'client is budget-conscious',
            // Mass-assignment attempts:
            user_id: 'someone-else',
            wardrobe_id: 'another-wardrobe',
            id: 'overwrite-me',
        })

        expect(update).toHaveBeenCalledTimes(1)
        const written = update.mock.calls[0][0]
        expect(written).toEqual({ internal_note: 'client is budget-conscious' })
        expect(written).not.toHaveProperty('user_id')
        expect(written).not.toHaveProperty('wardrobe_id')
        expect(written).not.toHaveProperty('id')
    })

    it('refuses an unknown status', async () => {
        const res = await updateAdminWardrobeItem(ITEM_ID, { status: 'Incinerate' })
        expect(res.success).toBe(false)
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it('refuses an empty update instead of issuing a no-op write', async () => {
        const res = await updateAdminWardrobeItem(ITEM_ID, {})
        expect(res.success).toBe(false)
        expect(res.error).toBe('Nothing to update')
        expect(mockFrom).not.toHaveBeenCalled()
    })
})

describe('bulk status', () => {
    it('applies one status across the selected ids and reports the count', async () => {
        const ids = [ITEM_ID, WARDROBE_ID]
        const inFn = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: ids[0] }, { id: ids[1] }], error: null }) })
        const update = vi.fn().mockReturnValue({ in: inFn })
        mockFrom.mockReturnValue({ update })

        const res = await bulkSetItemStatus(ids, 'Tailor')

        expect(res.success).toBe(true)
        expect(res.updated).toBe(2)
        expect(update).toHaveBeenCalledWith({ status: 'Tailor' })
        expect(inFn).toHaveBeenCalledWith('id', ids)
    })

    it('rejects an empty selection', async () => {
        const res = await bulkSetItemStatus([], 'Keep')
        expect(res.success).toBe(false)
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it('rejects an unknown status', async () => {
        const res = await bulkSetItemStatus([ITEM_ID], 'Burn')
        expect(res.success).toBe(false)
        expect(mockFrom).not.toHaveBeenCalled()
    })
})

describe('no browser query may ask for every wardrobe_items column', () => {
    // Column privileges are enforced at query time, so a stray select('*') here
    // fails in the browser with "permission denied for column internal_note" —
    // at runtime, in front of a client, with a green test suite. Catch it here.
    it('has no bare select() or select(*) on wardrobe_items in client code', async () => {
        const { readFileSync, readdirSync, statSync } = await import('fs')
        const { join } = await import('path')

        const walk = (dir: string): string[] =>
            readdirSync(dir).flatMap(entry => {
                const full = join(dir, entry)
                return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : []
            })

        const offenders: string[] = []
        for (const file of walk('components')) {
            const src = readFileSync(file, 'utf8')
            if (!src.includes("from('wardrobe_items')")) continue
            // Look at each wardrobe_items query and the lines that follow it.
            const chunks = src.split("from('wardrobe_items')").slice(1)
            for (const chunk of chunks) {
                const window = chunk.slice(0, 400)
                if (/\.select\(\s*\)/.test(window) || /\.select\(\s*['"`]\*['"`]\s*\)/.test(window)) {
                    offenders.push(file)
                }
            }
        }

        expect(offenders).toEqual([])
    })
})

describe('schemas', () => {
    it('adminWardrobeItemUpdateSchema accepts the private note', () => {
        const parsed = adminWardrobeItemUpdateSchema.safeParse({ internal_note: 'note' })
        expect(parsed.success).toBe(true)
    })

    it('bulkStatusSchema caps the batch size', () => {
        const tooMany = Array.from({ length: 201 }, () => ITEM_ID)
        expect(bulkStatusSchema.safeParse({ item_ids: tooMany, status: 'Keep' }).success).toBe(false)
    })
})
