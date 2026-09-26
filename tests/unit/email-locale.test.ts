/**
 * Every email a member can receive, in her language (2026-09-25 external
 * assessment, I18N-001).
 *
 * Only the purchase welcome was bilingual. Sign-in, signup, reset and the
 * answer notification were English whatever the reader's language, the shared
 * footer said "You received this email because…" in English even inside the
 * Spanish welcome, and the signup email reused the sign-in copy, greeting a
 * brand-new member with "Welcome back".
 */
import { describe, it, expect } from 'vitest'
import {
    emailLocale,
    getAnswerNotificationHtml,
    getAnswerNotificationSubject,
    getAuthEmailSubject,
    getMagicLinkHtml,
    getPasswordResetHtml,
    getPurchaseWelcomeHtml,
    getSignupConfirmHtml,
} from '@/lib/email-templates'

const url = 'https://example.test/link'

describe('auth and answer emails in Spanish', () => {
    it.each([
        ['sign-in', getMagicLinkHtml(url, 'es'), 'Tu enlace de acceso', 'Entrar al Vault'],
        ['signup', getSignupConfirmHtml(url, 'es'), 'Bienvenida al Vault', 'Confirmar y entrar'],
        ['reset', getPasswordResetHtml(url, 'es'), 'Restablecer contraseña', 'Restablecer contraseña'],
        ['answer', getAnswerNotificationHtml('q', 'a', 'es'), 'Tienes una respuesta', 'Ir al Vault'],
    ])('the %s email is Spanish throughout, footer included', (_, html, heading, cta) => {
        expect(html).toContain('<html lang="es">')
        expect(html).toContain(heading)
        expect(html).toContain(cta)
        expect(html).toContain('Recibiste este correo porque')
        expect(html).not.toContain('You received this email because')
    })

    it('has Spanish subjects', () => {
        expect(getAuthEmailSubject('signin', 'es')).toBe('Inicia sesión en AC Styling')
        expect(getAuthEmailSubject('reset', 'es')).toBe('Restablece tu contraseña de AC Styling')
        expect(getAuthEmailSubject('signup', 'es')).toMatch(/^Bienvenida/)
        expect(getAnswerNotificationSubject('es')).toBe('Respuesta a tu pregunta - AC Styling')
    })

    it('stays English by default, with the link intact', () => {
        const html = getMagicLinkHtml(url)
        expect(html).toContain('<html lang="en">')
        expect(html).toContain('Enter The Vault')
        expect(html).toContain(`href="${url}"`)
        expect(getAuthEmailSubject('signin')).toBe('Sign in to AC Styling')
    })

    it('does not greet a new member as a returning one', () => {
        expect(getSignupConfirmHtml(url)).not.toContain('Welcome back')
        expect(getSignupConfirmHtml(url, 'es')).not.toContain('de nuevo')
    })

    it('localizes the purchase welcome footer too', () => {
        const html = getPurchaseWelcomeHtml(url, 'Colorimetría', 'es')
        expect(html).toContain('<html lang="es">')
        expect(html).toContain('Recibiste este correo porque completaste una compra')
    })

    it('narrows anything but es to en', () => {
        expect(emailLocale('es')).toBe('es')
        expect(emailLocale('fr')).toBe('en')
        expect(emailLocale(null)).toBe('en')
    })
})
