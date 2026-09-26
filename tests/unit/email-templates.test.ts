import { describe, it, expect } from 'vitest'
import {
    escapeHtml,
    getAnswerNotificationHtml,
    getMagicLinkHtml,
    getPasswordResetHtml,
    getPurchaseWelcomeHtml,
    getPurchaseWelcomeSubject,
} from '@/lib/email-templates'

describe('email-templates', () => {
    describe('escapeHtml', () => {
        it('neutralizes HTML control characters', () => {
            expect(escapeHtml('<script>alert(1)</script>')).toBe(
                '&lt;script&gt;alert(1)&lt;/script&gt;'
            )
            expect(escapeHtml(`" ' & < >`)).toBe('&quot; &#39; &amp; &lt; &gt;')
        })

        it('handles empty / nullish input', () => {
            expect(escapeHtml('')).toBe('')
            // @ts-expect-error runtime guard for nullish
            expect(escapeHtml(null)).toBe('')
        })
    })

    describe('getAnswerNotificationHtml', () => {
        it('does not emit an injected script tag verbatim', () => {
            const html = getAnswerNotificationHtml(
                '<img src=x onerror=alert(1)>',
                '</p><script>steal()</script>'
            )

            expect(html).not.toContain('<script>steal()</script>')
            expect(html).not.toContain('<img src=x onerror=alert(1)>')
            expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;')
        })
    })

    describe('footer', () => {
        const ALL = [
            ['magic link', getMagicLinkHtml('https://example.test/link')],
            ['password reset', getPasswordResetHtml('https://example.test/reset')],
            ['answer notification', getAnswerNotificationHtml('q', 'a')],
            ['purchase welcome', getPurchaseWelcomeHtml('https://example.test/set', 'The Vault')],
        ] as const

        it.each(ALL)('%s carries the postal address', (_name, html) => {
            expect(html).toContain('1865 S Ocean Dr')
            expect(html).toContain('Hallandale Beach, FL 33009')
        })

        it.each(ALL)('%s says why it was received', (_name, html) => {
            expect(html).toContain('You received this email because')
        })

        it.each(ALL)('%s offers a way to reach a human', (_name, html) => {
            expect(html).toContain('mailto:hello@theacstyle.com')
        })

        // These are transactional, not commercial. An unsubscribe link on a
        // password reset would be nonsense; this pins that choice so it is not
        // "fixed" later by someone pattern-matching on CAN-SPAM.
        it.each(ALL)('%s does not offer to unsubscribe', (_name, html) => {
            expect(html.toLowerCase()).not.toContain('unsubscribe')
        })
    })

    describe('links', () => {
        it('points the Vault button at the real domain', () => {
            const html = getAnswerNotificationHtml('q', 'a')

            // Was hardcoded to ac-styling.com, which this brand does not own.
            expect(html).not.toContain('ac-styling.com')
            // In her language, so the button does not bounce a Spanish reader
            // through a redirect to English.
            expect(html).toContain('theacstyle.com/en/vault')
            expect(getAnswerNotificationHtml('q', 'a', 'es')).toContain('theacstyle.com/es/vault')
        })
    })

    describe('language', () => {
        // A Spanish buyer used to receive an English email at the one moment
        // she is being asked to set a password.
        it('sends the purchase welcome in Spanish when the buyer bought in Spanish', () => {
            const html = getPurchaseWelcomeHtml('https://example.test/set', 'Acceso Completo', 'es')

            expect(html).toContain('Tu acceso está listo')
            expect(html).toContain('Definir tu contraseña')
            expect(html).not.toContain('Your access is ready')
        })

        it('localizes the subject line too', () => {
            expect(getPurchaseWelcomeSubject('es')).toBe('Tu acceso al Vault de AC Styling')
            expect(getPurchaseWelcomeSubject('en')).toBe('Your AC Styling Vault access')
        })

        it('localizes the footer reason, not just the body', () => {
            const html = getPurchaseWelcomeHtml('https://example.test/set', 'Acceso', 'es')
            expect(html).toContain('completaste una compra')
        })

        it('defaults to English, so an unrecorded locale still sends', () => {
            // Sessions created before the locale was captured have no metadata.
            const html = getPurchaseWelcomeHtml('https://example.test/set', 'Full Access')

            expect(html).toContain('Your access is ready')
            expect(getPurchaseWelcomeSubject()).toBe('Your AC Styling Vault access')
        })

        it('still escapes the product name in either language', () => {
            const html = getPurchaseWelcomeHtml('https://example.test/set', '<script>x</script>', 'es')

            expect(html).not.toContain('<script>x</script>')
            expect(html).toContain('&lt;script&gt;')
        })
    })
})
