/**
 * The /welcome fast lane stops working once she has any other way in.
 *
 * A purchase claim lets whoever holds the Stripe checkout session id — a weak
 * credential that sits in browser history and referrers — set the account's
 * password, for 24 hours. It was closed on the password-reset page only
 * (closePurchaseClaims, called from UpdatePasswordClient). Any other way of
 * getting in — the emailed link opened, then a password set some other way,
 * or no password at all — left it open, so a holder of the session id could
 * overwrite her password afterwards (2026-09-25 external assessment, SEC-003).
 *
 * Claims are minted only for an account nobody has signed in to (the
 * webhook's needsWayIn). So the server-enforced rule is simple: once the
 * account has signed in, the claim is spent and refused, however she got in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { admin, consume, isOpen, signIn, retrieve } = vi.hoisted(() => ({
    admin: {
        auth: {
            admin: {
                listUsers: vi.fn(),
                getUserById: vi.fn(),
                updateUserById: vi.fn(),
            },
        },
        rpc: vi.fn(),
    },
    consume: vi.fn(),
    isOpen: vi.fn(),
    signIn: vi.fn(),
    retrieve: vi.fn(),
}))

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({ auth: { signInWithPassword: signIn } }),
}))
vi.mock('@/utils/stripe', () => ({ stripe: { checkout: { sessions: { retrieve } } } }))
vi.mock('@/app/lib/rate-limit', () => ({ checkEmailRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }))
vi.mock('@/app/lib/purchase-claims', () => ({ consumePurchaseClaim: consume, isClaimOpen: isOpen }))

import { claimPurchase, getPurchaseSession } from '@/app/actions/vault/claim-purchase'

const EMAIL = 'buyer@example.invalid'

function account(lastSignIn: string | null) {
    return { id: 'buyer-id', email: EMAIL, last_sign_in_at: lastSignIn }
}

beforeEach(() => {
    vi.clearAllMocks()
    retrieve.mockResolvedValue({
        payment_status: 'paid',
        created: Math.floor(Date.now() / 1000) - 60,
        customer_details: { email: EMAIL },
    })
    consume.mockResolvedValue({ userId: 'buyer-id' })
    isOpen.mockResolvedValue(true)
    admin.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null })
    signIn.mockResolvedValue({ error: null })
})

describe('claimPurchase', () => {
    it('sets the first password for an account nobody has signed in to', async () => {
        admin.auth.admin.getUserById.mockResolvedValue({ data: { user: account(null) }, error: null })

        const result = await claimPurchase('cs_test_1', 'a-good-password')

        expect(result).toEqual({ success: true, signedIn: true })
        expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('buyer-id', { password: 'a-good-password' })
    })

    it('refuses once the account has signed in any other way', async () => {
        admin.auth.admin.getUserById.mockResolvedValue({ data: { user: account('2026-09-26T01:00:00Z') }, error: null })

        const result = await claimPurchase('cs_test_1', 'attacker-password')

        expect(result.success).toBe(false)
        expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
    })

    it('refuses when the account cannot be read, rather than assuming it is new', async () => {
        admin.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'down' } })

        const result = await claimPurchase('cs_test_1', 'a-good-password')

        expect(result.success).toBe(false)
        expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
    })
})

describe('getPurchaseSession', () => {
    it('does not offer the form for an account that has signed in', async () => {
        admin.auth.admin.listUsers.mockResolvedValue({ data: { users: [account('2026-09-26T01:00:00Z')] }, error: null })

        const info = await getPurchaseSession('cs_test_1')

        expect(info).toMatchObject({ ok: true, claimable: false })
    })

    it('offers it while nobody has', async () => {
        admin.auth.admin.listUsers.mockResolvedValue({ data: { users: [account(null)] }, error: null })

        const info = await getPurchaseSession('cs_test_1')

        expect(info).toMatchObject({ ok: true, claimable: true })
    })
})

// SCALE-001: the welcome page found her account by paging through at most
// 2,000 users. Past that it said "still being set up" for ever.
describe('finding her account', () => {
    it.fails('finds it however many accounts there are', async () => {
        const page = (n: number) => Array.from({ length: 200 }, (_, i) => ({ id: `other-${n}-${i}`, email: `o${n}-${i}@example.invalid`, last_sign_in_at: null }))
        admin.auth.admin.listUsers.mockImplementation(async ({ page: n }: { page: number }) => ({ data: { users: page(n) }, error: null }))
        admin.rpc.mockResolvedValue({ data: 'buyer-id', error: null })
        admin.auth.admin.getUserById.mockResolvedValue({ data: { user: account(null) }, error: null })

        const info = await getPurchaseSession('cs_test_1')

        expect(info).toMatchObject({ ok: true, claimable: true })
    })
})

