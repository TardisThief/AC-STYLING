/**
 * The lapsed-renewal banner sends a member to where she can buy.
 *
 * Found in the 2026-09-28 paid-path rehearsal: past the grace window the
 * banner's "See the current price" linked to /vault/join, the signup form —
 * a dead end for someone who is signed in (the banner only ever renders for a
 * member with a term). It now goes to the sales page, whose checkout attaches
 * her purchase to her account (tests/unit/sales-page-checkout.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import en from '@/messages/en.json'

const DAY = 24 * 60 * 60 * 1000

vi.mock('next-intl/server', () => ({
    getTranslations: async () => (key: string, values?: Record<string, string | number>) => {
        const msg = (en.Vault.renewal as Record<string, string>)[key]
        return values ? msg.replace(/\{(\w+)\}/g, (_, k) => String(values[k])) : msg
    },
}))
vi.mock('@/i18n/routing', () => ({
    Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>{children}</a>
    ),
}))
vi.mock('@/app/actions/stripe', () => ({
    getRenewalQuote: async () => ({
        amountCents: 15000,
        currency: 'usd',
        expiresAt: new Date(Date.now() - 31 * DAY).toISOString(),
        graceEnd: new Date(Date.now() - DAY).toISOString(),
        renewable: false,
    }),
}))
vi.mock('@/components/vault/RenewAccessButton', () => ({ default: () => <button>renew</button> }))

import RenewAccessBanner from '@/components/vault/RenewAccessBanner'

describe('RenewAccessBanner, past the grace window', () => {
    it('says the price has reset and links to the sales page, not the signup form', async () => {
        render(await RenewAccessBanner({ locale: 'en', accessExpiresAt: new Date(Date.now() - 31 * DAY).toISOString() }) as React.ReactElement)

        expect(screen.getByText(en.Vault.renewal.resetTitle)).toBeInTheDocument()
        const cta = screen.getByRole('link', { name: en.Vault.renewal.resetCta })
        expect(cta).toHaveAttribute('href', '/vault-access')
    })
})
