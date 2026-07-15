import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChainableMock } from '../utils/supabase-mock'

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'
const OTHER_UUID = '223e4567-e89b-12d3-a456-426614174000'

// Service-role client used by getAdminBrands to read sensitive columns.
const mockAdminFrom = vi.fn()
vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

// RLS-respecting server client. `profiles` serves requireAdmin's role check;
// every other table routes to mockWriteFrom so tests can observe writes.
const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'
const mockWriteFrom = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
                }
            }
            return mockWriteFrom(table)
        }),
    })),
}))

// `unstable_cache` is pulled in transitively via app/lib/trusted-by (the landing
// page's cached logo read); it must pass the wrapped fn through untouched.
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    updateTag: vi.fn(),
    unstable_cache: (fn: unknown) => fn,
}))

import {
    getAdminBrands,
    createBrand,
    updateBrand,
    deleteBrand,
    createBoutiqueItem,
    createCollection,
    setCollectionItems,
    createTrustedByLogo,
    updateTrustedByLogo,
} from '@/app/actions/admin/manage-boutique'

beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRole = 'admin'
    mockWriteFrom.mockImplementation(() => createChainableMock({ data: null, error: null }))
})

describe('getAdminBrands', () => {
    it('rejects unauthenticated callers before touching the service role', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } })

        const result = await getAdminBrands()

        expect(result.success).toBe(false)
        expect(result.error).toBe('Unauthorized')
        expect(mockAdminFrom).not.toHaveBeenCalled()
    })

    it('rejects authenticated non-admin callers', async () => {
        mockRole = 'user'

        const result = await getAdminBrands()

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
        expect(mockAdminFrom).not.toHaveBeenCalled()
    })

    it('returns full brand rows (including sensitive fields) for an admin', async () => {
        const brands = [{ id: '1', name: 'Zara', internal_notes: 'secret', commission_rate: 0.15 }]
        mockAdminFrom.mockReturnValue(createChainableMock({ data: brands, error: null }))

        const result = await getAdminBrands()

        expect(result.success).toBe(true)
        expect(result.brands).toHaveLength(1)
        expect(result.brands?.[0].internal_notes).toBe('secret')
    })
})

describe('createBrand', () => {
    it('rejects a missing name with a readable error and no DB write', async () => {
        const result = await createBrand({ name: '', logo_url: 'https://x.test/logo.png' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Name is required')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('rejects an invalid contact email by name', async () => {
        const result = await createBrand({ name: 'Zara', contact_email: 'not-an-email' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Contact email must be a valid email address')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('rejects a non-numeric commission rate', async () => {
        const result = await createBrand({ name: 'Zara', commission_rate: 'abc' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Commission rate must be a number')
    })

    it('inserts exactly the schema columns, with coercion and empty→null', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom.mockReturnValue({ insert })

        const result = await createBrand({
            name: '  Zara  ',
            logo_url: '',
            website_url: 'https://zara.com',
            contact_name: '',
            contact_email: '',
            commission_rate: '12.5',
            partnership_status: '',
            internal_notes: '',
        })

        expect(result.success).toBe(true)
        expect(mockWriteFrom).toHaveBeenCalledWith('partner_brands')
        expect(insert).toHaveBeenCalledWith({
            name: 'Zara',
            logo_url: null,
            website_url: 'https://zara.com',
            active: true,
            contact_name: null,
            contact_email: null,
            commission_rate: 12.5,
            partnership_status: 'active',
            internal_notes: null,
        })
    })

    it('rejects non-admins before validating', async () => {
        mockRole = 'user'

        const result = await createBrand({ name: 'Zara' })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
    })
})

describe('updateBrand / deleteBrand', () => {
    it('updateBrand rejects a malformed id before writing', async () => {
        const result = await updateBrand('not-a-uuid', { name: 'Zara' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Brand id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('updateBrand writes the parsed row for a valid id', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        const update = vi.fn(() => ({ eq }))
        mockWriteFrom.mockReturnValue({ update })

        const result = await updateBrand(VALID_UUID, { name: 'Zara', active: false })

        expect(result.success).toBe(true)
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Zara', active: false }))
        expect(eq).toHaveBeenCalledWith('id', VALID_UUID)
    })

    it('deleteBrand rejects a malformed id', async () => {
        const result = await deleteBrand('nope')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Brand id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })
})

describe('createBoutiqueItem', () => {
    it('requires name and image URL', async () => {
        const result = await createBoutiqueItem({ name: '', image_url: '' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Name is required')
        expect(result.error).toContain('Image URL is required')
    })

    it('turns an empty brand_id into null', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom.mockReturnValue({ insert })

        const result = await createBoutiqueItem({ name: 'Bag', image_url: 'https://x.test/b.jpg', brand_id: '' })

        expect(result.success).toBe(true)
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ brand_id: null }))
    })
})

describe('collections', () => {
    it('createCollection returns the new id and requires a title', async () => {
        const single = vi.fn().mockResolvedValue({ data: { id: VALID_UUID }, error: null })
        const select = vi.fn(() => ({ single }))
        const insert = vi.fn(() => ({ select }))
        mockWriteFrom.mockReturnValue({ insert })

        const ok = await createCollection({ title: 'Summer', order_index: 2 })
        expect(ok).toEqual({ success: true, id: VALID_UUID })
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Summer', order_index: 2, active: true }))

        const bad = await createCollection({ title: '' })
        expect(bad.success).toBe(false)
        expect(bad.error).toContain('Title is required')
    })

    it('setCollectionItems validates every id before deleting/inserting', async () => {
        const result = await setCollectionItems(VALID_UUID, ['not-a-uuid'])

        expect(result.success).toBe(false)
        expect(result.error).toContain('Item id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('setCollectionItems replaces rows for valid ids', async () => {
        const del = { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) }
        const insert = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom
            .mockReturnValueOnce(del)
            .mockReturnValueOnce({ insert })

        const result = await setCollectionItems(VALID_UUID, [OTHER_UUID])

        expect(result.success).toBe(true)
        expect(insert).toHaveBeenCalledWith([
            { collection_id: VALID_UUID, item_id: OTHER_UUID, position: 0 },
        ])
    })
})

describe('trusted-by logos', () => {
    it('createTrustedByLogo requires name and logo URL', async () => {
        const result = await createTrustedByLogo({ name: '', logo_url: '' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Name is required')
        expect(result.error).toContain('Logo URL is required')
    })

    it('updateTrustedByLogo passes through only the keys provided (partial update)', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        const update = vi.fn(() => ({ eq }))
        mockWriteFrom.mockReturnValue({ update })

        const result = await updateTrustedByLogo(VALID_UUID, { active: false })

        expect(result.success).toBe(true)
        expect(update).toHaveBeenCalledWith({ active: false })
    })
})
