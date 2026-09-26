/**
 * The auth screens speak the reader's language (2026-09-25 external
 * assessment, I18N-001).
 *
 * Login, signup, forgot-password, confirm and /vault/join had no translations
 * at all: a Spanish-first audience met English at the one step every member
 * passes through. Rendered here under the Spanish dictionary; any English
 * string that was hardcoded before fails the test.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import es from '@/messages/es.json'

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/es/login',
}))
vi.mock('@/i18n/routing', () => ({
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('@/utils/supabase/client', () => ({
    createClient: () => ({
        auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
            getSession: async () => ({ data: { session: null } }),
        },
    }),
}))
vi.mock('@/app/actions/auth', () => ({ requestPasswordReset: vi.fn(), signUpSeamless: vi.fn() }))
vi.mock('@/app/actions/onboarding', () => ({ processOnboarding: vi.fn() }))

import LoginPage from '@/app/[locale]/(auth)/login/LoginClient'
import SignupPage from '@/app/[locale]/(auth)/signup/SignupClient'
import ForgotPasswordPage from '@/app/[locale]/(auth)/forgot-password/ForgotPasswordClient'
import AuthConfirmPage from '@/app/[locale]/(auth)/confirm/ConfirmClient'
import JoinPage from '@/app/[locale]/vault/join/JoinClient'

function inSpanish(ui: ReactElement) {
    return render(<NextIntlClientProvider locale="es" messages={es}>{ui}</NextIntlClientProvider>)
}

const ENGLISH = [
    'Access your Vault', 'Send Login Link', 'Email Address', 'Password', 'Forgot?', 'Start your membership',
    'Join the Lab', 'Create Account', 'Continue with Google', 'Already have an account?',
    'Reset Password', 'Send Reset Link', 'Back to Login',
    'Authenticated', 'Verifying authentication',
    'Create your account', 'Full Name', 'Join The Vault', 'Sign in here',
]

describe.each([
    ['login', () => <LoginPage />, 'Entra a tu Vault'],
    ['signup', () => <SignupPage />, 'Únete al Lab'],
    ['forgot password', () => <ForgotPasswordPage />, 'Restablecer contraseña'],
    ['confirm', () => <AuthConfirmPage />, 'Acceso verificado'],
    ['join', () => <JoinPage />, 'Crea tu cuenta'],
])('the %s screen in Spanish', (_, ui, heading) => {
    it('shows its Spanish heading and no English copy', async () => {
        const { container } = inSpanish(ui())

        expect(await screen.findByText(heading)).toBeInTheDocument()
        const text = container.textContent ?? ''
        for (const english of ENGLISH) expect(text, english).not.toContain(english)
    })
})
