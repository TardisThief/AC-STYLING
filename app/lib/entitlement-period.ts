/**
 * How long access lasts, and what the next year costs.
 *
 * Vault access used to be perpetual. It is now a one-year term with a renewal
 * price that steps down in thirds — year one at the price paid, year two at two
 * thirds of it, year three and every year after at one third. A $150 pass
 * renews at $100, then $50, forever.
 *
 * The ladder is a reward for staying, so it only survives while she keeps
 * renewing: past the grace window below, she buys again at the current list
 * price and starts from the bottom rung.
 *
 * Everything here is pure arithmetic on purpose. The rule is the part of this
 * feature most likely to be argued about later, and it should be readable and
 * testable without a database, a Stripe key or a clock that anyone has to mock
 * beyond `Date`.
 */

/** One year of access per purchase. */
export const ACCESS_TERM_DAYS = 365;

/**
 * How long after expiry her ladder price is still honoured.
 *
 * This holds the *price*, not the access: the Vault locks the day the term
 * ends. The window exists so a failed card or a fortnight away does not cost
 * her the discount she has spent years earning.
 */
export const RENEWAL_GRACE_DAYS = 30;

/** Stripe refuses a charge below this, so the ladder cannot fall through it. */
const MIN_CHARGE_CENTS = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When the term she is buying should end.
 *
 * Measured from the later of now and any expiry she already holds, so renewing
 * early adds a year rather than throwing the remainder away. Renewing on the
 * last day and renewing three months early both leave her with the same total,
 * which is the only version of this anyone would call fair.
 */
export function nextExpiry(current: string | null | undefined, now: Date = new Date()): string {
    const held = current ? new Date(current) : null;
    const from =
        held && !Number.isNaN(held.getTime()) && held.getTime() > now.getTime() ? held : now;
    return new Date(from.getTime() + ACCESS_TERM_DAYS * DAY_MS).toISOString();
}

/**
 * Is she still inside the window where her ladder price is honoured?
 *
 * A null expiry is not "infinitely within grace" — it is someone who bought
 * before the term existed and holds perpetual access. She has nothing to renew,
 * so this is false for her.
 */
export function withinGrace(
    expiresAt: string | null | undefined,
    now: Date = new Date()
): boolean {
    if (!expiresAt) return false;
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime())) return false;
    return now.getTime() <= expiry.getTime() + RENEWAL_GRACE_DAYS * DAY_MS;
}

/** The last day her ladder price is available, for telling her so. */
export function graceEnds(expiresAt: string): string {
    return new Date(new Date(expiresAt).getTime() + RENEWAL_GRACE_DAYS * DAY_MS).toISOString();
}

/**
 * What the next year costs, off what she actually paid.
 *
 * `renewalCount` is how many rungs she has already climbed: 0 means this is her
 * first renewal (two thirds), 1 or more means every renewal after it (one
 * third). It does not keep falling — one third is the floor, not a step.
 *
 * Deliberately a function of the original amount rather than of the last one
 * charged: halving a half compounds, and three renewals in she would be paying
 * cents. The caller finds the original by taking her most recent purchase that
 * was not itself a renewal.
 */
export function renewalAmountCents(originalCents: number, renewalCount: number): number {
    if (!Number.isFinite(originalCents) || originalCents <= 0) return 0;
    const fraction = renewalCount <= 0 ? 2 / 3 : 1 / 3;
    return Math.max(MIN_CHARGE_CENTS, Math.round(originalCents * fraction));
}

/** How long before the term ends we start saying so. */
export const RENEWAL_NOTICE_DAYS = 30;

/**
 * Which of the four things there is to say about her term right now.
 *
 * A state machine rather than a pile of date comparisons at the call site, for
 * two reasons: the difference between "ended" and "lapsed" decides whether we
 * quote her a price we will actually honour, and reading the clock inside a
 * component is both untestable and something the lint rules rightly refuse.
 *
 *   none   — nothing to say; most of the year lives here
 *   soon   — inside the last month, still live
 *   ended  — expired, but her rung is still held
 *   lapsed — expired past the grace window; the ladder has reset
 */
export type RenewalNotice = 'none' | 'soon' | 'ended' | 'lapsed';

export function renewalNotice(
    expiresAt: string | null | undefined,
    now: Date = new Date()
): RenewalNotice {
    // Null is perpetual access from before the term existed. Nothing expires,
    // so there is nothing to warn her about.
    if (!expiresAt) return 'none';

    const expiry = new Date(expiresAt).getTime();
    if (Number.isNaN(expiry)) return 'none';

    if (expiry - now.getTime() > RENEWAL_NOTICE_DAYS * DAY_MS) return 'none';
    if (expiry > now.getTime()) return 'soon';
    return withinGrace(expiresAt, now) ? 'ended' : 'lapsed';
}
