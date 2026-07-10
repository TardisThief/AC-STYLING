/**
 * Normalize a caller-supplied post-auth redirect target to a same-origin
 * relative path, preventing open-redirect abuse via `?next=` params/cookies.
 *
 * Returns a path that always begins with a single `/`. Anything that could
 * escape the origin — absolute URLs, protocol-relative `//host`, backslash
 * tricks, or control characters — falls back to `fallback`.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/en/vault'): string {
    if (!next || typeof next !== 'string') return fallback;

    // Reject control characters / whitespace that browsers may strip, and any
    // backslash (used in "/\evil.com" protocol-relative tricks).
    if (/[\s\x00-\x1f\x7f\\]/.test(next)) return fallback;

    // Must be a relative path rooted at "/", but not "//" (protocol-relative).
    if (!next.startsWith('/')) return fallback;
    if (next.startsWith('//')) return fallback;

    // Defense in depth: if it still parses as an absolute URL, reject it.
    // A relative path throws here (no base); an absolute URL does not.
    try {
        const parsed = new URL(next);
        // Parsed as absolute — not a safe relative path.
        if (parsed) return fallback;
        return next;
    } catch {
        return next;
    }
}
