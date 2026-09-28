/**
 * A member buying from the public sales page pays as herself.
 *
 * Found in the 2026-09-28 paid-path rehearsal: a signed-in member whose access
 * had lapsed bought the pass again from /vault-access and was sent through the
 * GUEST checkout — no client_reference_id, an email typed into Stripe, and a
 * return to /welcome telling her to sign in. Had she typed another address,
 * the purchase would have gone to a different (or brand-new) account while
 * hers got nothing. The page hard-coded `isSignedIn={false}` on the grounds
 * that "a member never sees this page", which stopped being true when the
 * sales page got its own public address; the lapsed-renewal banner now sends
 * members there on purpose.
 *
 * The page is prerendered and cannot read cookies, so the decision is made at
 * click time by a server action. Only Supabase's session, Stripe's network
 * and the catalogue price check are replaced here; the real actions run.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

const h = vi.hoisted(() => ({
    user: null as null | { id: string; email: string; is_anonymous?: boolean },
    create: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/app/lib/sellable-price', () => ({ isSellablePrice: async () => true }))
vi.mock('@/utils/stripe', () => ({ stripe: { checkout: { sessions: { create: (p: unknown) => h.create(p) } } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'https://www.theacstyle.com' }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/app/lib/analytics', () => ({ trackCta: vi.fn() }))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import VaultCheckoutButton from '@/components/vault-sales/VaultCheckoutButton'

const realLocation = window.location

beforeEach(() => {
    h.create.mockReset()
    h.create.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_x' })
    h.user = null
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, href: '' } })
})
afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

/** The button as /vault-access renders it: the page cannot know who is looking. */
async function buyFromSalesPage() {
    render(
        <NextIntlClientProvider locale="es" messages={{}}>
            <VaultCheckoutButton priceId="price_pass" section="offer_masterclass_pass" label="Get the pass" unavailableLabel="Soon" />
        </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Get the pass' }))
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1))
    return h.create.mock.calls[0][0] as Record<string, unknown> & { metadata: Record<string, string> }
}

describe('checkout from /vault-access', () => {
    it('a signed-in member pays as herself and returns to the Vault', async () => {
        h.user = { id: 'member-1', email: 'member@example.invalid' }
        const params = await buyFromSalesPage()

        expect(params.client_reference_id).toBe('member-1')
        expect(params.customer_email).toBe('member@example.invalid')
        expect(params.metadata.flow).toBeUndefined()
        expect(String(params.success_url)).not.toContain('/welcome')
    })

    it('a visitor with no account gets the guest checkout, in her language', async () => {
        const params = await buyFromSalesPage()

        expect(params.client_reference_id).toBeUndefined()
        expect(params.metadata).toMatchObject({ flow: 'guest', locale: 'es' })
        expect(String(params.success_url)).toContain('/es/welcome')
    })

    it('an anonymous guest session is not an account: guest checkout', async () => {
        h.user = { id: 'anon-1', email: '', is_anonymous: true }
        const params = await buyFromSalesPage()

        expect(params.client_reference_id).toBeUndefined()
        expect(params.metadata.flow).toBe('guest')
    })
})
