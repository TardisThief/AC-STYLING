/**
 * The /welcome page only says "we emailed you a link" when we did.
 *
 * Found in the 2026-09-28 paid-path rehearsal: a guest checkout under an email
 * that already had a signed-in account was told "We also emailed you a link
 * to get in", and nothing arrived. The webhook sends that email only while the
 * account has never been signed in (`needsWayIn`, app/api/webhooks/stripe),
 * which is the same fact `claimable` reports here; for an established account
 * the page promised an email that is never sent.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import en from '@/messages/en.json'

const getPurchaseSession = vi.fn()
vi.mock('@/app/actions/vault/claim-purchase', () => ({
    getPurchaseSession: (id: string) => getPurchaseSession(id),
}))
vi.mock('next-intl/server', () => ({
    setRequestLocale: vi.fn(),
    getTranslations: async () => (key: string, values?: Record<string, string>) => {
        const msg = (en.VaultWelcome as Record<string, string>)[key]
        return values ? msg.replace(/\{(\w+)\}/g, (_, k) => values[k]) : msg
    },
}))
vi.mock('@/i18n/routing', () => ({
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('@/components/Navbar', () => ({ default: () => null }))
vi.mock('@/components/Footer', () => ({ default: () => null }))
vi.mock('@/components/vault-sales/ClaimAccessForm', () => ({ default: () => <form aria-label="claim" /> }))

import WelcomePage from '@/app/[locale]/welcome/page'

async function renderWelcome() {
    const ui = await WelcomePage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ session_id: 'cs_test_1' }),
    })
    return render(ui)
}

const EMAILED = en.VaultWelcome.emailFallback

describe('/welcome', () => {
    it('an account that already signs in is sent to login, with no promise of an email', async () => {
        getPurchaseSession.mockResolvedValue({ ok: true, email: 'a@b.co', claimable: false })
        await renderWelcome()

        expect(screen.getByText(en.VaultWelcome.alreadyHasPassword, { exact: false })).toBeInTheDocument()
        expect(screen.queryByText(EMAILED)).not.toBeInTheDocument()
    })

    it('a new account gets the password form and is told about the email', async () => {
        getPurchaseSession.mockResolvedValue({ ok: true, email: 'a@b.co', claimable: true })
        await renderWelcome()

        expect(screen.getByRole('form', { name: 'claim' })).toBeInTheDocument()
        expect(screen.getByText(EMAILED)).toBeInTheDocument()
    })

    it('an account still being created is told about the email that is on its way', async () => {
        getPurchaseSession.mockResolvedValue({ ok: true, email: 'a@b.co', pending: true })
        await renderWelcome()

        expect(screen.getByText(EMAILED)).toBeInTheDocument()
    })
})
