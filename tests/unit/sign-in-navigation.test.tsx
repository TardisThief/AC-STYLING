/**
 * A browser-side sign-in must enter the Vault with a full page load.
 *
 * Found in the 2026-09-28 paid-path rehearsal, reproduced on the live site:
 * after a password login the navbar's Profile link pointed at /vault/join
 * until the page was reloaded. The login page shows a "Start your membership"
 * link to /vault/join, which production prefetches while she is signed out;
 * /vault/join shares the Vault layout, so the client router cache held a
 * signed-out render of that layout, and a client-side `router.push('/vault')`
 * after signing in reused it. `router.refresh()` only clears the current
 * route, so it does not reach the prefetched layout. The welcome page's
 * password form never showed the bug because it signs in inside a server
 * action, which invalidates the whole client cache.
 *
 * So these tests pin the navigation itself: every sign-in that happens in the
 * browser leaves with `window.location.assign`, never `router.push`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/messages/en.json'

const push = vi.fn()
vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/en/login',
}))
vi.mock('@/i18n/routing', () => ({
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
    useRouter: () => ({ push }),
}))

const signInWithPassword = vi.fn()
const signInAnonymously = vi.fn()
const signOut = vi.fn()
let existingSession: { user: { id: string } } | null = null
vi.mock('@/utils/supabase/client', () => ({
    createClient: () => ({
        auth: {
            signInWithPassword,
            signInAnonymously,
            signOut,
            getSession: async () => ({ data: { session: existingSession } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
    }),
}))
vi.mock('@/app/actions/onboarding', () => ({ processOnboarding: async () => ({ success: true }) }))
vi.mock('@/app/actions/vault/account', () => ({ deleteAccount: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import LoginPage from '@/app/[locale]/(auth)/login/LoginClient'
import GuestAccessLink from '@/components/vault-sales/GuestAccessLink'
import AuthConfirmPage from '@/app/[locale]/(auth)/confirm/ConfirmClient'
import AccountSettings from '@/components/vault/AccountSettings'

const assign = vi.fn()
const replace = vi.fn()
const realLocation = window.location

beforeEach(() => {
    push.mockReset()
    assign.mockReset()
    replace.mockReset()
    signOut.mockReset()
    existingSession = null
    signInWithPassword.mockReset()
    signInAnonymously.mockReset()
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...realLocation, assign, replace, hash: '', origin: 'https://www.theacstyle.com' },
    })
})
afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

function renderLogin() {
    return render(
        <NextIntlClientProvider locale="en" messages={en}>
            <LoginPage />
        </NextIntlClientProvider>
    )
}

describe('entering the Vault after a browser-side sign-in', () => {
    it('a password login loads the Vault fresh rather than pushing to it', async () => {
        signInWithPassword.mockResolvedValue({ error: null })
        const { container } = renderLogin()

        fireEvent.click(screen.getByRole('button', { name: en.Auth.common.password }))
        fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: 'a@b.co' } })
        fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'pw' } })
        fireEvent.submit(container.querySelector('form')!)

        await waitFor(() => expect(assign).toHaveBeenCalledWith('/en/vault'))
        expect(push).not.toHaveBeenCalled()
    })

    it('a failed password login stays on the page', async () => {
        signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
        const { container } = renderLogin()

        fireEvent.click(screen.getByRole('button', { name: en.Auth.common.password }))
        fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: 'a@b.co' } })
        fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'pw' } })
        fireEvent.submit(container.querySelector('form')!)

        await waitFor(() => expect(signInWithPassword).toHaveBeenCalled())
        expect(assign).not.toHaveBeenCalled()
        expect(push).not.toHaveBeenCalled()
    })

    it('the guest link on the sales page loads the Vault fresh, in her language', async () => {
        signInAnonymously.mockResolvedValue({ error: null })
        render(
            <NextIntlClientProvider locale="es" messages={en}>
                <GuestAccessLink label="Log in as a guest" loadingLabel="…" errorLabel="No" />
            </NextIntlClientProvider>
        )

        fireEvent.click(await screen.findByRole('button', { name: 'Log in as a guest' }))

        await waitFor(() => expect(assign).toHaveBeenCalledWith('/es/vault'))
        expect(push).not.toHaveBeenCalled()
    })

    it('the confirm screen (magic link, signup) loads the Vault fresh and leaves no history entry', async () => {
        existingSession = { user: { id: 'u1' } }
        render(
            <NextIntlClientProvider locale="es" messages={en}>
                <AuthConfirmPage />
            </NextIntlClientProvider>
        )

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/es/vault'))
        expect(assign).not.toHaveBeenCalled()
        expect(push).not.toHaveBeenCalled()
    })
})

describe('leaving after a browser-side sign-out', () => {
    it('loads the login page fresh, so no signed-in page is left in the router cache', async () => {
        signOut.mockResolvedValue({ error: null })
        render(
            <NextIntlClientProvider locale="en" messages={en}>
                <AccountSettings />
            </NextIntlClientProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

        await waitFor(() => expect(assign).toHaveBeenCalledWith('/en/login'))
        expect(signOut).toHaveBeenCalledTimes(1)
        expect(push).not.toHaveBeenCalled()
    })
})
