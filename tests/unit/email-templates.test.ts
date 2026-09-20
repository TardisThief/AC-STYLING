import { describe, it, expect } from 'vitest'
import {
    escapeHtml,
    getAnswerNotificationHtml,
    getMagicLinkHtml,
    getPasswordResetHtml,
    getPurchaseWelcomeHtml,
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
            expect(html).toContain('mailto:fashionstylist.ac@gmail.com')
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
            expect(html).toContain('theacstyle.com/vault')
        })
    })
})
