/**
 * Pure HTML-to-text conversion for the email templates.
 *
 * Lives apart from lib/resend.ts deliberately: that module constructs a Resend
 * client at import time, so anything importing it needs an API key or a mock.
 * This has no such dependency and can be imported and tested directly.
 */

/**
 * Derive a plain-text alternative from the HTML body.
 *
 * An HTML-only message is a long-standing spam signal — SpamAssassin scores it
 * directly (MIME_HTML_ONLY) and the major providers treat a missing text/plain
 * part as a sign the sender is not a normal mail client. Every template here is
 * simple enough that a structural strip produces a genuinely readable message
 * rather than a token one, which is the point: a text part nobody could read is
 * no better than none.
 *
 * Links are kept as "label (url)" so the text part is actually actionable for
 * anyone reading it, including the recipient whose client blocks HTML.
 */
export function htmlToText(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        // Keep the destination of every link, not just its label.
        .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
            const text = String(label).replace(/<[^>]+>/g, '').trim();
            // Parentheses, not angle brackets: the generic tag-stripper below
            // runs after this and would eat `<https://...>` as if it were a
            // tag, silently dropping every destination.
            return text && !href.startsWith('mailto:') ? `${text} (${href})` : text || href;
        })
        .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&middot;/g, '·')
        .replace(/&copy;/g, '(c)')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        // &amp; last, so an escaped entity is not double-decoded.
        .replace(/&amp;/g, '&')
        .split('\n')
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .filter((line, i, all) => line !== '' || all[i - 1] !== '')
        .join('\n')
        .trim();
}
