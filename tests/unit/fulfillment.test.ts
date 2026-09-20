/**
 * Durable fulfillment state (F05).
 *
 * The state these protect, stated plainly:
 *   - a line item already completed is never redone, so a replayed delivery
 *     cannot duplicate a purchase or a grant;
 *   - a line item left `processing` by a crash IS redone, because the
 *     alternative turns a crash into a permanently stuck purchase;
 *   - "no content matches this product" is terminal, not a failure, so a
 *     service booking is not retried forever;
 *   - completion is only ever recorded after the grant, which is the bug the
 *     whole finding is about.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    claimLineItem,
    markCompleted,
    markFailed,
    markUnfulfillable,
} from '@/app/lib/fulfillment'

type Outcome = { data: unknown; error: unknown }

function mockTable() {
    const calls: Record<string, unknown[]> = {}
    let readResult: Outcome = { data: null, error: null }
    let writeResult: Outcome = { data: null, error: null }

    const chain = {
        select: (...a: unknown[]) => { calls.select = a; return chain },
        eq: (...a: unknown[]) => { calls.eq = a; return chain },
        maybeSingle: () => Promise.resolve(readResult),
        upsert: (...a: unknown[]) => { calls.upsert = a; return Promise.resolve(writeResult) },
        update: (...a: unknown[]) => { calls.update = a; return chain },
        then: <T>(resolve: (v: Outcome) => T) => Promise.resolve(writeResult).then(resolve),
    }

    return {
        chain,
        calls,
        setExisting(row: unknown) { readResult = { data: row, error: null } },
        setReadError(message: string) { readResult = { data: null, error: { message } } },
        setWriteError(message: string) { writeResult = { data: null, error: { message } } },
    }
}

const clientFor = (t: ReturnType<typeof mockTable>) =>
    ({ from: vi.fn(() => t.chain) }) as never

const ref = {
    lineItemId: 'li_1',
    sessionId: 'cs_1',
    eventId: 'evt_1',
    userId: 'user-1',
    productId: 'prod_1',
    amountTotal: 5000,
    currency: 'usd',
}

describe('claimLineItem', () => {
    beforeEach(() => vi.clearAllMocks())

    it('claims a line item that has never been seen', async () => {
        const t = mockTable()
        await expect(claimLineItem(clientFor(t), ref)).resolves.toEqual({ state: 'claimed' })
    })

    it('refuses to redo a completed line item', async () => {
        const t = mockTable()
        t.setExisting({ status: 'completed', attempts: 1 })

        // This is what makes a replayed delivery safe.
        await expect(claimLineItem(clientFor(t), ref)).resolves.toEqual({ state: 'already_completed' })
        expect(t.calls.upsert).toBeUndefined()
    })

    it('refuses to redo a line item settled as unfulfillable', async () => {
        const t = mockTable()
        t.setExisting({ status: 'unfulfillable', attempts: 1 })

        await expect(claimLineItem(clientFor(t), ref)).resolves.toEqual({ state: 'already_unfulfillable' })
    })

    it('re-claims a row left processing by a crashed run', async () => {
        const t = mockTable()
        t.setExisting({ status: 'processing', attempts: 1 })

        // Treating a stale `processing` row as owned would turn a crash into a
        // permanently stuck purchase — the exact failure this replaces.
        await expect(claimLineItem(clientFor(t), ref)).resolves.toEqual({ state: 'claimed' })
    })

    it('re-claims a previously failed row and counts the attempt', async () => {
        const t = mockTable()
        t.setExisting({ status: 'failed', attempts: 2 })

        await expect(claimLineItem(clientFor(t), ref)).resolves.toEqual({ state: 'claimed' })
        expect((t.calls.upsert?.[0] as { attempts: number }).attempts).toBe(3)
    })

    it('keys the upsert on the line item id, which is the idempotency boundary', async () => {
        const t = mockTable()
        await claimLineItem(clientFor(t), ref)

        expect((t.calls.upsert?.[1] as { onConflict: string }).onConflict).toBe('stripe_line_item_id')
        expect((t.calls.upsert?.[0] as { stripe_line_item_id: string }).stripe_line_item_id).toBe('li_1')
    })

    it('reports an error rather than proceeding untracked when the read fails', async () => {
        const t = mockTable()
        t.setReadError('connection reset')

        const result = await claimLineItem(clientFor(t), ref)
        expect(result.state).toBe('error')
    })

    it('reports an error when the claim cannot be written', async () => {
        const t = mockTable()
        t.setWriteError('permission denied')

        const result = await claimLineItem(clientFor(t), ref)
        expect(result.state).toBe('error')
    })
})

describe('status transitions', () => {
    beforeEach(() => vi.clearAllMocks())

    it('records completion with a timestamp and clears any previous error', async () => {
        const t = mockTable()
        await markCompleted(clientFor(t), 'li_1')

        const patch = t.calls.update?.[0] as { status: string; completed_at: string; last_error: null }
        expect(patch.status).toBe('completed')
        expect(patch.completed_at).toBeTruthy()
        expect(patch.last_error).toBeNull()
    })

    it('records the reason a line item failed', async () => {
        const t = mockTable()
        await markFailed(clientFor(t), 'li_1', 'grant insert exploded')

        const patch = t.calls.update?.[0] as { status: string; last_error: string }
        expect(patch.status).toBe('failed')
        expect(patch.last_error).toContain('grant insert exploded')
    })

    it('truncates a pathological error rather than writing it whole', async () => {
        const t = mockTable()
        await markFailed(clientFor(t), 'li_1', 'x'.repeat(10_000))

        expect((t.calls.update?.[0] as { last_error: string }).last_error.length).toBe(2000)
    })

    it('settles an unmatched product as terminal, not as a failure', async () => {
        const t = mockTable()
        await markUnfulfillable(clientFor(t), 'li_1', 'no content matches prod_x')

        const patch = t.calls.update?.[0] as { status: string; completed_at: string }
        expect(patch.status).toBe('unfulfillable')
        // Stamped as settled so it is not picked up by a retry sweep.
        expect(patch.completed_at).toBeTruthy()
    })

    it('does not throw when the bookkeeping write itself fails', async () => {
        const t = mockTable()
        t.setWriteError('db down')

        // The buyer already has access; losing the record is bad but throwing
        // here would turn it into a failed delivery and a pointless retry.
        await expect(markCompleted(clientFor(t), 'li_1')).resolves.toBeUndefined()
    })
})
