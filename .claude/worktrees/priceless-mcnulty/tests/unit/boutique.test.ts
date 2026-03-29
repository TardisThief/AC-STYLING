import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChainableMock } from '../utils/supabase-mock'

// Mock Supabase using proper chainable mocks
const mockFrom = vi.fn()
const mockAuth = { getUser: vi.fn() }

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: mockAuth,
        from: mockFrom,
    })),
}))

// Import after mocks
import { getActiveBrands, getBoutiqueItems } from '@/app/actions/boutique'

describe('Boutique Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getActiveBrands', () => {
        it('returns active brands successfully', async () => {
            const mockBrands = [
                { id: '1', name: 'Zara', logo_url: 'https://logo.url/zara.png', active: true },
                { id: '2', name: 'Massimo Dutti', logo_url: 'https://logo.url/md.png', active: true },
            ]

            mockFrom.mockReturnValue(createChainableMock({ data: mockBrands, error: null }))

            const result = await getActiveBrands()

            expect(result.success).toBe(true)
            expect(result.brands).toHaveLength(2)
        })

        it('handles database errors', async () => {
            mockFrom.mockReturnValue(createChainableMock({ data: null, error: { message: 'DB Error' } }))

            const result = await getActiveBrands()

            expect(result.success).toBe(false)
            expect(result.error).toBe('DB Error')
        })
    })

    describe('getBoutiqueItems', () => {
        it('returns all active items when no brand filter', async () => {
            const mockItems = [
                { id: '1', name: 'Cashmere Sweater', brand: { name: 'Zara' } },
                { id: '2', name: 'Silk Blouse', brand: { name: 'Massimo Dutti' } },
            ]

            mockFrom.mockReturnValue(createChainableMock({ data: mockItems, error: null }))

            const result = await getBoutiqueItems()

            expect(result.success).toBe(true)
            expect(result.items).toHaveLength(2)
        })

        it('filters by brand when brandId provided', async () => {
            const mockItems = [
                { id: '1', name: 'Cashmere Sweater', brand_id: 'brand-123', brand: { name: 'Zara' } },
            ]

            mockFrom.mockReturnValue(createChainableMock({ data: mockItems, error: null }))

            const result = await getBoutiqueItems('brand-123')

            expect(result.success).toBe(true)
            expect(result.items).toHaveLength(1)
            expect(result.items?.[0].brand_id).toBe('brand-123')
        })

        it('returns empty array when no items match', async () => {
            mockFrom.mockReturnValue(createChainableMock({ data: [], error: null }))

            const result = await getBoutiqueItems('nonexistent-brand')

            expect(result.success).toBe(true)
            expect(result.items).toHaveLength(0)
        })

        it('handles database errors', async () => {
            mockFrom.mockReturnValue(createChainableMock({ data: null, error: { message: 'Query failed' } }))

            const result = await getBoutiqueItems()

            expect(result.success).toBe(false)
            expect(result.error).toBe('Query failed')
        })
    })
})
