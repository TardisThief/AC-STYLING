import { describe, it, expect } from 'vitest'
import { escapeHtml, getAnswerNotificationHtml } from '@/lib/email-templates'

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
})
