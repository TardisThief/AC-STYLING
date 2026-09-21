import { describe, it, expect, vi, afterEach } from 'vitest'
import { isBoutiqueOpen, canBrowseBoutique } from '@/app/lib/release'

describe('release switches', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('keeps the boutique closed when BOUTIQUE_OPEN is unset', () => {
        vi.stubEnv('BOUTIQUE_OPEN', undefined)
        expect(isBoutiqueOpen()).toBe(false)
    })

    it('opens the boutique however the flag is spelled', () => {
        vi.stubEnv('BOUTIQUE_OPEN', 'TRUE')
        expect(isBoutiqueOpen()).toBe(true)
    })

    it('lets only admins browse a closed boutique', () => {
        vi.stubEnv('BOUTIQUE_OPEN', undefined)
        expect(canBrowseBoutique('admin')).toBe(true)
        expect(canBrowseBoutique('member')).toBe(false)
        expect(canBrowseBoutique(null)).toBe(false)
    })

    it('lets everyone browse an open boutique', () => {
        vi.stubEnv('BOUTIQUE_OPEN', 'true')
        expect(canBrowseBoutique(null)).toBe(true)
    })
})
