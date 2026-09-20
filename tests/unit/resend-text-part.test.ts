/**
 * Every email must carry a readable text/plain part.
 *
 * HTML-only mail is scored as spam directly (SpamAssassin MIME_HTML_ONLY) and
 * treated by the major providers as a sign the sender is not a normal mail
 * client. The first real delivery test of this system landed in Gmail's spam
 * folder; HTML-only was one of the concrete, fixable causes.
 *
 * A text part nobody could read would be no better than none, so these check
 * that the derived text actually carries the message — including where the
 * links go.
 */

import { describe, it, expect } from 'vitest'
// Imported from the pure module, not @/lib/resend, which tests/setup.ts mocks
// wholesale to keep the Resend client out of the suite.
import { htmlToText } from '@/lib/html-to-text'
import {
    getMagicLinkHtml,
    getPasswordResetHtml,
    getPurchaseWelcomeHtml,
    getAnswerNotificationHtml,
} from '@/lib/email-templates'

describe('htmlToText', () => {
    it('drops the stylesheet rather than reading it out', () => {
        const text = htmlToText(getMagicLinkHtml('https://example.test/link'))

        expect(text).not.toContain('font-family')
        expect(text).not.toContain('background-color')
        expect(text).not.toContain('<')
    })

    it('keeps the destination of a link, not just its label', () => {
        const text = htmlToText(getMagicLinkHtml('https://example.test/magic'))

        // A recipient reading the text part must still be able to sign in.
        expect(text).toContain('https://example.test/magic')
        expect(text).toContain('Enter The Vault')
    })

    it('decodes entities without double-decoding an escaped ampersand', () => {
        expect(htmlToText('<p>&amp;lt;not a tag&amp;gt;</p>')).toBe('&lt;not a tag&gt;')
        expect(htmlToText('<p>Tom &amp; Jerry</p>')).toBe('Tom & Jerry')
    })

    it('does not collapse into a single run-on line', () => {
        const text = htmlToText(getPurchaseWelcomeHtml('https://example.test/set', 'The Vault'))
        expect(text.split('\n').length).toBeGreaterThan(3)
    })

    it('carries the footer address into the text part', () => {
        const text = htmlToText(getPasswordResetHtml('https://example.test/reset'))

        expect(text).toContain('1865 S Ocean Dr')
        expect(text).toContain('You received this email because')
    })

    it('shows user content literally, since text/plain cannot execute it', () => {
        // The HTML part escapes this to &lt;script&gt;. Decoding it back to
        // literal angle brackets in the text part is correct and faithful to
        // what the person actually typed -- a text/plain part is not parsed as
        // markup, so there is nothing to neutralize.
        const text = htmlToText(getAnswerNotificationHtml('<script>alert(1)</script>', 'answer'))

        expect(text).toContain('<script>alert(1)</script>')
        // The surrounding template markup is still gone.
        expect(text).not.toContain('<div')
        expect(text).not.toContain('class=')
    })
})
