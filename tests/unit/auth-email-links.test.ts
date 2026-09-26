/**
 * The links in auth emails, and what an auth email is allowed to prove.
 *
 * Found by the 2026-09-25 external assessment:
 *
 * AUTH-001 — every email-based auth action built its link to `/auth/confirm`.
 * No such route exists: the confirmation page is `/[locale]/confirm`, and the
 * proxy matcher skips `auth/*`, so next-intl never redirects it either.
 * Login, signup, password reset and /vault/join all landed on a 404.
 *
 * SEC-001 — signUpWithMagicLink, a public action, found an existing
 * unconfirmed account and marked it confirmed with the service role before
 * anyone had opened a single email. Combined with /vault/join (which creates
 * an unconfirmed account WITH a password), that let anyone pre-register a
 * victim's address with a password of their choosing, get it verified, and
 * then own the account the victim's later purchase is attached to
 * (resolveOrCreateUserByEmail reuses an existing account by email).
 *
 * Opening the emailed link is the only proof of the mailbox. And a link that
 * proves it also confirms the account — which would make a password somebody
 * else chose usable. So before any link goes to an unconfirmed account, the
 * password on it is replaced with one nobody knows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'

const { admin, getLocale, headerMap } = vi.hoisted(() => ({
    admin: {
        auth: {
            admin: {
                generateLink: vi.fn(),
                updateUserById: vi.fn(),
                createUser: vi.fn(),
            },
        },
    },
    getLocale: vi.fn(),
    headerMap: { current: new Map<string, string>() },
}))

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('next-intl/server', () => ({ getLocale }))
vi.mock('next/headers', () => ({
    headers: async () => ({ get: (k: string) => headerMap.current.get(k.toLowerCase()) ?? null }),
}))
vi.mock('@/app/lib/rate-limit', () => ({
    checkEmailRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

import {
    requestPasswordReset,
    signInWithMagicLink,
    signUpSeamless,
    signUpWithMagicLink,
} from '@/app/actions/auth'
import { sendEmail } from '@/lib/resend'

const ORIGIN = 'https://www.theacstyle.com'

function linkFor(user: { id: string; email_confirmed_at: string | null }) {
    return {
        data: {
            user: { ...user, user_metadata: {} },
            properties: { action_link: 'https://project.supabase.co/auth/v1/verify?token=t' },
        },
        error: null,
    }
}

const unconfirmed = { id: 'victim-id', email_confirmed_at: null }
const confirmed = { id: 'member-id', email_confirmed_at: '2026-09-01T00:00:00Z' }

function joinForm() {
    const form = new FormData()
    form.set('email', 'new@example.invalid')
    form.set('password', 'a-long-password')
    form.set('fullName', 'New Member')
    return form
}

const actions = {
    signInWithMagicLink: () => signInWithMagicLink('someone@example.invalid', '/vault'),
    signUpWithMagicLink: () => signUpWithMagicLink('someone@example.invalid', '/vault'),
    requestPasswordReset: () => requestPasswordReset('someone@example.invalid'),
    signUpSeamless: () => signUpSeamless(joinForm(), '/vault'),
}

/** The redirect the action asked Supabase to send the reader to. */
function redirectTarget(): URL {
    const call = admin.auth.admin.generateLink.mock.calls.at(-1)
    return new URL(call![0].options.redirectTo)
}

beforeEach(() => {
    vi.clearAllMocks()
    headerMap.current = new Map([['origin', ORIGIN]])
    getLocale.mockResolvedValue('en')
    admin.auth.admin.generateLink.mockResolvedValue(linkFor(confirmed))
    admin.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null })
    admin.auth.admin.createUser.mockResolvedValue({ data: { user: { id: 'new-id' } }, error: null })
    vi.mocked(sendEmail).mockResolvedValue({ success: true, data: { id: 'msg_1' } })
})

describe('auth email links (AUTH-001)', () => {
    it('targets a page that exists', () => {
        expect(existsSync('app/[locale]/(auth)/confirm/page.tsx')).toBe(true)
    })

    it.each(Object.keys(actions))('%s sends the reader to /en/confirm', async name => {
        await actions[name as keyof typeof actions]()

        expect(redirectTarget().origin).toBe(ORIGIN)
        expect(redirectTarget().pathname).toBe('/en/confirm')
    })

    it.each(Object.keys(actions))('%s keeps a Spanish reader in Spanish', async name => {
        getLocale.mockResolvedValue('es')

        await actions[name as keyof typeof actions]()

        expect(redirectTarget().pathname).toBe('/es/confirm')
    })

    it('falls back to English for a locale the site does not serve', async () => {
        getLocale.mockResolvedValue('fr')

        await signInWithMagicLink('someone@example.invalid')

        expect(redirectTarget().pathname).toBe('/en/confirm')
    })

    it('carries a same-site next path through', async () => {
        await signInWithMagicLink('someone@example.invalid', '/es/vault/foundations')

        expect(redirectTarget().searchParams.get('next')).toBe('/es/vault/foundations')
    })

    it('drops a next that would leave the site', async () => {
        await signInWithMagicLink('someone@example.invalid', '//attacker.invalid/phish')

        expect(redirectTarget().searchParams.get('next')).toBeNull()
    })
})

describe('auth emails in the reader’s language (I18N-001)', () => {
    it.each([
        ['signInWithMagicLink', 'Inicia sesión en AC Styling'],
        ['requestPasswordReset', 'Restablece tu contraseña de AC Styling'],
        ['signUpSeamless', 'Bienvenida a AC Styling: confirma tu correo'],
    ])('%s writes to a Spanish reader in Spanish', async (name, subject) => {
        getLocale.mockResolvedValue('es')

        await actions[name as keyof typeof actions]()

        const sent = vi.mocked(sendEmail).mock.calls[0][0]
        expect(sent.subject).toBe(subject)
        expect(sent.html).toContain('<html lang="es">')
    })

    it('greets a brand-new signup as new, not as a returning member', async () => {
        admin.auth.admin.generateLink
            .mockResolvedValueOnce({ data: null, error: { message: 'User not found' } })
            .mockResolvedValueOnce(linkFor({ id: 'new-id', email_confirmed_at: '2026-09-26T00:00:00Z' }))

        await signUpWithMagicLink('new@example.invalid')

        const sent = vi.mocked(sendEmail).mock.calls[0][0]
        expect(sent.subject).toMatch(/^Welcome to AC Styling/)
        expect(sent.html).not.toContain('Welcome back')
    })
})

describe('an auth email proves nothing until it is opened (SEC-001)', () => {
    it('signUpWithMagicLink never confirms an existing account itself', async () => {
        admin.auth.admin.generateLink.mockResolvedValue(linkFor(unconfirmed))

        await signUpWithMagicLink('victim@example.invalid')

        const confirmedIt = admin.auth.admin.updateUserById.mock.calls.some(
            ([, attrs]) => attrs?.email_confirm === true
        )
        expect(confirmedIt).toBe(false)
    })

    const emailing = {
        signInWithMagicLink: () => signInWithMagicLink('victim@example.invalid'),
        signUpWithMagicLink: () => signUpWithMagicLink('victim@example.invalid'),
        requestPasswordReset: () => requestPasswordReset('victim@example.invalid'),
    }

    it.each(Object.keys(emailing))(
        '%s replaces the password on an unconfirmed account before emailing a link',
        async name => {
            admin.auth.admin.generateLink.mockResolvedValue(linkFor(unconfirmed))

            const result = await emailing[name as keyof typeof emailing]()

            expect(result).toEqual({ success: true })
            const rotate = admin.auth.admin.updateUserById.mock.calls.find(
                ([id, attrs]) => id === 'victim-id' && typeof attrs?.password === 'string'
            )
            expect(rotate).toBeDefined()
            expect(rotate![1].password.length).toBeGreaterThanOrEqual(32)
            expect(rotate![1].email_confirm).toBeUndefined()
            const rotatedAt = admin.auth.admin.updateUserById.mock.invocationCallOrder[
                admin.auth.admin.updateUserById.mock.calls.indexOf(rotate!)
            ]
            expect(rotatedAt).toBeLessThan(vi.mocked(sendEmail).mock.invocationCallOrder[0])
        }
    )

    it.each(Object.keys(emailing))(
        '%s sends nothing when the password could not be replaced',
        async name => {
            admin.auth.admin.generateLink.mockResolvedValue(linkFor(unconfirmed))
            admin.auth.admin.updateUserById.mockResolvedValue({ data: null, error: { message: 'down' } })

            const result = await emailing[name as keyof typeof emailing]()

            expect(result).toHaveProperty('error')
            expect(sendEmail).not.toHaveBeenCalled()
        }
    )

    it.each(Object.keys(emailing))('%s leaves a confirmed account alone', async name => {
        admin.auth.admin.generateLink.mockResolvedValue(linkFor(confirmed))

        await emailing[name as keyof typeof emailing]()

        expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
        expect(sendEmail).toHaveBeenCalledTimes(1)
    })
})
