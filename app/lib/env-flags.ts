/**
 * Reading boolean environment variables without being precious about spelling.
 *
 * Every flag in this app used to compare `=== 'true'` against the raw value.
 * That is a trap: the Vercel dashboard is a free-text box, the value is
 * frequently typed or displayed as `TRUE`, and `'TRUE' !== 'true'`. The flag
 * then silently does nothing, which looks exactly like a broken feature rather
 * than a broken setting — and there is no error to find, because nothing went
 * wrong. Setting `VAULT_REVEAL_UPCOMING=TRUE` on 2026-09-21 is what surfaced
 * it.
 *
 * So accept what someone plainly meant: case-insensitive, whitespace
 * tolerant, and the three obvious synonyms. Anything else, including unset, is
 * false — a flag that has to be explicitly enabled should not be enabled by a
 * typo either.
 */

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

/**
 * Whether an environment flag is switched on.
 *
 * Takes the **value**, not the variable name, on purpose. Next inlines
 * `process.env.NEXT_PUBLIC_*` by matching that literal expression in the
 * source, so a helper that looked the name up itself would break every
 * client-side flag. Call it as `isEnabled(process.env.MY_FLAG)` and the
 * literal stays where the compiler can see it.
 */
export function isEnabled(value: string | undefined): boolean {
    return value !== undefined && TRUTHY.has(value.trim().toLowerCase());
}
