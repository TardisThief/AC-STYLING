/**
 * What the prerendered sales page shows to whoever is actually looking.
 *
 * Found in the 2026-09-28 paid-path rehearsal:
 *  - "Log in as a guest" showed to signed-in members, and clicking it swapped
 *    her real session for an anonymous one (an anonymous account appeared
 *    during the rehearsal's cleanup);
 *  - a member buying what she already holds had no answer but a Stripe
 *    checkout (the server now refuses it, tests/integration/already-owned);
 *  - and, at the owner's request, returning clients had no way to sign in
 *    from the page at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/messages/en.json'

const h = vi.hoisted(() => ({
    session: null as null | { user: { id: string; is_anonymous?: boolean } },
    checkout: vi.fn(),
    toastInfo: vi.fn(),
}))

vi.mock('@/utils/supabase/client', () => ({
    createClient: () => ({
        auth: {
            getSession: async () => ({ data: { session: h.session } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
            signInAnonymously: vi.fn(),
        },
    }),
}))
vi.mock('@/i18n/routing', () => ({
    useRouter: () => ({ push: vi.fn() }),
    Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>{children}</a>
    ),
}))
vi.mock('@/app/actions/stripe', () => ({ createSalesPageCheckout: (...a: unknown[]) => h.checkout(...a) }))
vi.mock('@/app/lib/analytics', () => ({ trackCta: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: (...a: unknown[]) => h.toastInfo(...a) } }))

import GuestAccessLink from '@/components/vault-sales/GuestAccessLink'
import MemberEntryLink from '@/components/vault-sales/MemberEntryLink'
import VaultCheckoutButton from '@/components/vault-sales/VaultCheckoutButton'

const withIntl = (ui: React.ReactElement) =>
    render(<NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>)

const member = { user: { id: 'm1' } }
const anonymous = { user: { id: 'a1', is_anonymous: true } }

beforeEach(() => {
    h.session = null
    h.checkout.mockReset()
    h.toastInfo.mockReset()
})

describe('"Log in as a guest"', () => {
    const guestLink = () => withIntl(<GuestAccessLink label="Log in as a guest" loadingLabel="…" errorLabel="No" />)

    it('shows to a visitor with no session', async () => {
        guestLink()
        expect(await screen.findByRole('button', { name: 'Log in as a guest' })).toBeInTheDocument()
    })

    it('does not show to a signed-in member', async () => {
        h.session = member
        guestLink()
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Log in as a guest' })).not.toBeInTheDocument())
        // Still absent once the session check has certainly finished.
        await new Promise((r) => setTimeout(r, 0))
        expect(screen.queryByRole('button', { name: 'Log in as a guest' })).not.toBeInTheDocument()
    })

    it('does not show to someone already in as a guest', async () => {
        h.session = anonymous
        guestLink()
        await new Promise((r) => setTimeout(r, 0))
        expect(screen.queryByRole('button', { name: 'Log in as a guest' })).not.toBeInTheDocument()
    })
})

describe('the way back in for returning clients', () => {
    const entry = () => withIntl(<MemberEntryLink signInLabel="Sign in" enterVaultLabel="Go to the Vault" />)

    it('a visitor is offered sign-in', async () => {
        entry()
        expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    })

    it('a signed-in member is taken to her Vault, not asked to sign in', async () => {
        h.session = member
        entry()
        expect(await screen.findByRole('link', { name: 'Go to the Vault' })).toHaveAttribute('href', '/vault')
    })

    it('an anonymous guest has no account to be in: sign-in', async () => {
        h.session = anonymous
        entry()
        await new Promise((r) => setTimeout(r, 0))
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    })
})

describe('buying what she already holds', () => {
    it('says it is already hers, with the way into the Vault, instead of an error', async () => {
        h.checkout.mockResolvedValue({ alreadyOwned: true, error: 'You already have access to this. It is in your Vault.' })
        withIntl(<VaultCheckoutButton priceId="price_pass" section="offer_masterclass_pass" label="Get the pass" unavailableLabel="Soon" />)

        fireEvent.click(screen.getByRole('button', { name: 'Get the pass' }))

        await waitFor(() => expect(h.toastInfo).toHaveBeenCalledTimes(1))
        const [message, options] = h.toastInfo.mock.calls[0] as [string, { action: { label: string } }]
        expect(message).toBe(en.VaultSales.offer.alreadyOwned)
        expect(options.action.label).toBe(en.VaultSales.offer.openVault)
        // Usable again: nothing is navigating away.
        expect(screen.getByRole('button', { name: 'Get the pass' })).not.toBeDisabled()
    })
})
