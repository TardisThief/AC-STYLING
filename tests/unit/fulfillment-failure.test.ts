/**
 * Fulfillment must not report success it did not achieve.
 *
 * F05 in the 2026-09-19 assessment: `grantAccessForProduct` returned `true`
 * after a failed grant insert and ignored profile-update errors entirely. The
 * Stripe webhook read that as success, answered 200, and Stripe never retried
 * the delivery — so a buyer could be charged with nothing granted and no
 * second chance.
 *
 * The distinction these tests protect:
 *   `false` = this product is not content we grant (a service booking) — fine.
 *   throw    = a write that had to happen did not — the webhook rolls back its
 *              idempotency marker and returns 500 so Stripe retries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { grantAccessForProduct, GrantWriteError } from '@/app/lib/access-logic'

const emptyMatch = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
})

const found = (data: unknown) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
})

const profileUpdate = (error: unknown) => ({
    update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error }) })),
})

describe('fulfillment failure handling', () => {
    let from: ReturnType<typeof vi.fn>
    let supabase: { from: ReturnType<typeof vi.fn> }

    beforeEach(() => {
        vi.clearAllMocks()
        from = vi.fn()
        supabase = { from }
        vi.stubEnv('STRIPE_FULL_ACCESS_PRODUCT_ID', 'prod_full_access_123')
    })

    it('throws when a masterclass grant insert fails', async () => {
        from
            .mockReturnValueOnce(found({ id: 'mc-1', title: 'Colour' }))
            .mockReturnValueOnce({
                insert: vi.fn().mockResolvedValue({ error: { code: '500', message: 'db down' } }),
            })

        await expect(
            grantAccessForProduct(supabase as never, 'user-1', 'prod_mc')
        ).rejects.toBeInstanceOf(GrantWriteError)
    })

    it('treats a duplicate masterclass grant as success, not failure', async () => {
        // A replayed Stripe delivery hits the unique index. The end state is
        // correct, so this must not throw and must not ask Stripe to retry.
        from
            .mockReturnValueOnce(found({ id: 'mc-1', title: 'Colour' }))
            .mockReturnValueOnce({
                insert: vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate' } }),
            })

        await expect(
            grantAccessForProduct(supabase as never, 'user-1', 'prod_mc')
        ).resolves.toBe(true)
    })

    it('throws when a chapter grant insert fails', async () => {
        from
            .mockReturnValueOnce(emptyMatch())
            .mockReturnValueOnce(found({ id: 'ch-1', title: 'Silhouette' }))
            .mockReturnValueOnce({
                insert: vi.fn().mockResolvedValue({ error: { code: '500', message: 'db down' } }),
            })

        await expect(
            grantAccessForProduct(supabase as never, 'user-1', 'prod_ch')
        ).rejects.toBeInstanceOf(GrantWriteError)
    })

    it('throws when the full-unlock profile flag cannot be written', async () => {
        from
            .mockReturnValueOnce(emptyMatch()) // masterclass
            .mockReturnValueOnce(emptyMatch()) // chapter
            .mockReturnValueOnce(profileUpdate({ message: 'permission denied' }))

        await expect(
            grantAccessForProduct(supabase as never, 'user-1', 'prod_full_access_123')
        ).rejects.toBeInstanceOf(GrantWriteError)
    })

    it('still returns false for a product that is simply not content', async () => {
        from
            .mockReturnValueOnce(emptyMatch()) // masterclass
            .mockReturnValueOnce(emptyMatch()) // chapter
            .mockReturnValueOnce(emptyMatch()) // offers

        await expect(
            grantAccessForProduct(supabase as never, 'user-1', 'prod_service_booking')
        ).resolves.toBe(false)
    })

    describe('with STRIPE_FULL_ACCESS_PRODUCT_ID unset', () => {
        beforeEach(() => {
            vi.stubEnv('STRIPE_FULL_ACCESS_PRODUCT_ID', '')
        })

        it('does not hand a full unlock to a nullish product id', async () => {
            // `productId === FULL_UNLOCK_PRODUCT_ID` with both undefined was a
            // full unlock for anyone. Both callers guard before calling, but
            // the comparison must not rely on that.
            from
                .mockReturnValueOnce(emptyMatch()) // masterclass
                .mockReturnValueOnce(emptyMatch()) // chapter
                .mockReturnValueOnce(emptyMatch()) // offers

            await expect(
                grantAccessForProduct(supabase as never, 'user-1', undefined as never)
            ).resolves.toBe(false)
        })
    })
})
