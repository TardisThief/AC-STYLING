/**
 * Intake-token policy.
 *
 * Kept out of `app/actions/wardrobes.ts` on purpose: that file is
 * `"use server"`, and Next requires every export from such a module to be an
 * async function. Constants and a synchronous helper cannot live there — the
 * build fails with "Export … doesn't exist in target module", which is the
 * same rule `app/lib/validation/` exists for.
 */

/**
 * How long a Studio intake link stays usable.
 *
 * An intake link is a bearer credential: whoever holds it can upload to that
 * wardrobe and claim it. It used to be valid until someone manually archived
 * the wardrobe, so a link forwarded or left in an inbox stayed live for ever
 * (F10). One week, by the owner's decision on 2026-09-20.
 */
export const UPLOAD_TOKEN_TTL_DAYS = 7;

/** A fresh expiry, for every path that issues or rotates a token. */
export function uploadTokenExpiry(from: Date = new Date()): string {
    return new Date(from.getTime() + UPLOAD_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Upper bound on items in one wardrobe, enforced per upload.
 *
 * Deliberately high: it exists so a leaked link cannot be used to fill the
 * bucket, not to constrain a real client, and there is no usage data yet to
 * size it against. In code rather than the database so it can be tuned without
 * a migration once there are real numbers to tune it to.
 */
export const MAX_ITEMS_PER_WARDROBE = 500;
