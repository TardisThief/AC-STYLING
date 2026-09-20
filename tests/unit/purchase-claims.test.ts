/**
 * The purchase-claim credential (F06).
 *
 * What these protect, in one line each:
 *   - consuming is the check, so a second holder of a Stripe session id gets
 *     nothing even if they race the first;
 *   - establishing a password by any route closes the fast lane, which is the
 *     half that did not exist and left the takeover window open;
 *   - every failure fails closed, because the emailed recovery link is always
 *     available as the fallback and guessing "probably fine" is not.
 *
 * The atomicity itself is a property of the SQL, and was verified against the
 * live database when migration 13 was applied (first consume returns a row,
 * second returns none). These pin the application's half of the contract: that
 * it issues that statement, with those filters, and believes the answer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    createPurchaseClaim,
    consumePurchaseClaim,
    consumeClaimsForUser,
    isClaimOpen,
} from '@/app/lib/purchase-claims'

type Outcome = { data: unknown; error: unknown }

/**
 * A minimal stand-in for the Supabase query builder.
 *
 * It records the filters each call applies, which is what these tests actually
 * assert: the security of the claim rests on the update carrying
 * `.is('consumed_at', null)` and `.gt('expires_at', ...)`, so the query's shape
 * is the thing worth pinning.
 *
 * It is also thenable, because `.select()` without `.maybeSingle()` resolves
 * directly — that is the multi-row path `consumeClaimsForUser` takes.
 */
function mockTable() {
    const calls: Record<string, unknown[]> = {}
    let result: Outcome = { data: null, error: null }

    const record = (name: string) => (...args: unknown[]) => {
        calls[name] = args
        return chain
    }

    const chain = {
        // insert() is terminal; everything else keeps chaining.
        insert: (...args: unknown[]) => {
            calls.insert = args
            return Promise.resolve(result)
        },
        update: record('update'),
        select: record('select'),
        eq: record('eq'),
        is: record('is'),
        gt: record('gt'),
        maybeSingle: () => Promise.resolve(result),
        then: <T>(resolve: (value: Outcome) => T) => Promise.resolve(result).then(resolve),
    }

    return {
        chain,
        calls,
        setResult(r: Outcome) { result = r },
    }
}

const clientFor = (t: ReturnType<typeof mockTable>) =>
    ({ from: vi.fn(() => t.chain) }) as never

describe('purchase claims', () => {
    beforeEach(() => vi.clearAllMocks())

    describe('consumePurchaseClaim', () => {
        it('returns the account when it wins the claim', async () => {
            const t = mockTable()
            t.setResult({ data: { user_id: 'user-1' }, error: null })

            await expect(consumePurchaseClaim(clientFor(t), 'cs_1')).resolves.toEqual({ userId: 'user-1' })
        })

        it('only ever targets an unspent, unexpired claim', async () => {
            const t = mockTable()
            t.setResult({ data: { user_id: 'user-1' }, error: null })

            await consumePurchaseClaim(clientFor(t), 'cs_1')

            // These filters ARE the security check — without them the update
            // would happily spend a claim twice.
            expect(t.calls.eq).toEqual(['stripe_session_id', 'cs_1'])
            expect(t.calls.is).toEqual(['consumed_at', null])
            expect(t.calls.gt?.[0]).toBe('expires_at')
        })

        it('refuses when the claim was already spent or has expired', async () => {
            const t = mockTable()
            // No row came back: someone else won it, or it lapsed.
            t.setResult({ data: null, error: null })

            await expect(consumePurchaseClaim(clientFor(t), 'cs_1')).resolves.toBeNull()
        })

        it('fails closed when the query errors', async () => {
            const t = mockTable()
            t.setResult({ data: null, error: { message: 'table missing' } })

            await expect(consumePurchaseClaim(clientFor(t), 'cs_1')).resolves.toBeNull()
        })

        it('records why it was spent, so an incident can be reconstructed', async () => {
            const t = mockTable()
            t.setResult({ data: { user_id: 'user-1' }, error: null })

            await consumePurchaseClaim(clientFor(t), 'cs_1', 'claim')

            expect((t.calls.update?.[0] as { consumed_reason: string }).consumed_reason).toBe('claim')
        })
    })

    describe('consumeClaimsForUser', () => {
        it('closes every open window for the account', async () => {
            const t = mockTable()
            t.setResult({ data: [{ id: 'a' }, { id: 'b' }], error: null })

            await expect(consumeClaimsForUser(clientFor(t), 'user-1')).resolves.toBe(2)
            expect(t.calls.eq).toEqual(['user_id', 'user-1'])
            expect(t.calls.is).toEqual(['consumed_at', null])
        })

        it('marks them as closed by a password being set, not by the fast lane', async () => {
            const t = mockTable()
            t.setResult({ data: [], error: null })

            await consumeClaimsForUser(clientFor(t), 'user-1')

            expect((t.calls.update?.[0] as { consumed_reason: string }).consumed_reason).toBe('password_set')
        })

        it('reports zero rather than throwing when the query fails', async () => {
            const t = mockTable()
            t.setResult({ data: null, error: { message: 'db down' } })

            // A failure here must never block someone setting a password.
            await expect(consumeClaimsForUser(clientFor(t), 'user-1')).resolves.toBe(0)
        })
    })

    describe('isClaimOpen', () => {
        it('is true only for an unspent, unexpired claim', async () => {
            const t = mockTable()
            t.setResult({ data: { id: 'claim-1' }, error: null })

            await expect(isClaimOpen(clientFor(t), 'cs_1')).resolves.toBe(true)
            expect(t.calls.is).toEqual(['consumed_at', null])
            expect(t.calls.gt?.[0]).toBe('expires_at')
        })

        it('is false when nothing matches, and when the query errors', async () => {
            const miss = mockTable()
            miss.setResult({ data: null, error: null })
            await expect(isClaimOpen(clientFor(miss), 'cs_1')).resolves.toBe(false)

            const broken = mockTable()
            broken.setResult({ data: null, error: { message: 'boom' } })
            await expect(isClaimOpen(clientFor(broken), 'cs_1')).resolves.toBe(false)
        })
    })

    describe('createPurchaseClaim', () => {
        it('treats a duplicate webhook delivery as success, not a second credential', async () => {
            const t = mockTable()
            t.setResult({ data: null, error: { code: '23505', message: 'duplicate key' } })

            await expect(
                createPurchaseClaim(clientFor(t), { userId: 'u', stripeSessionId: 'cs_1', email: 'A@B.com' })
            ).resolves.toBe(true)
        })

        it('reports a real insert failure', async () => {
            const t = mockTable()
            t.setResult({ data: null, error: { code: '42P01', message: 'relation does not exist' } })

            await expect(
                createPurchaseClaim(clientFor(t), { userId: 'u', stripeSessionId: 'cs_1', email: 'a@b.com' })
            ).resolves.toBe(false)
        })

        it('normalizes the email and sets an expiry in the future', async () => {
            const t = mockTable()
            t.setResult({ data: null, error: null })

            await createPurchaseClaim(clientFor(t), {
                userId: 'u', stripeSessionId: 'cs_1', email: '  Buyer@Example.COM ',
            })

            const row = t.calls.insert?.[0] as { email: string; expires_at: string }
            expect(row.email).toBe('buyer@example.com')
            expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now())
        })
    })
})
