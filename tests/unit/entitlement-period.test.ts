/**
 * The one-year term and the thirds ladder.
 *
 * This is the arithmetic behind what we charge people, so it is tested against
 * a fixed clock rather than "now": a rule about money should fail loudly when
 * it changes, not quietly on a leap year.
 */

import { describe, it, expect } from 'vitest'
import {
    ACCESS_TERM_DAYS,
    RENEWAL_GRACE_DAYS,
    graceEnds,
    nextExpiry,
    renewalAmountCents,
    renewalNotice,
    withinGrace,
} from '@/app/lib/entitlement-period'

const NOW = new Date('2026-09-24T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const days = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString()

describe('nextExpiry', () => {
    it('gives a year from today to a first purchase', () => {
        expect(nextExpiry(null, NOW)).toBe(days(ACCESS_TERM_DAYS))
    })

    it('extends from the date she already holds, so renewing early loses nothing', () => {
        // 100 days left. Renewing today must leave her with 465, not 365.
        expect(nextExpiry(days(100), NOW)).toBe(days(100 + ACCESS_TERM_DAYS))
    })

    it('starts from today when what she held has already expired', () => {
        expect(nextExpiry(days(-40), NOW)).toBe(days(ACCESS_TERM_DAYS))
    })

    it('ignores an unparseable stored date rather than producing one', () => {
        expect(nextExpiry('not a date', NOW)).toBe(days(ACCESS_TERM_DAYS))
    })
})

describe('withinGrace', () => {
    it('holds the price for the whole window after expiry', () => {
        expect(withinGrace(days(-1), NOW)).toBe(true)
        expect(withinGrace(days(-(RENEWAL_GRACE_DAYS - 1)), NOW)).toBe(true)
    })

    it('is still true on the last day and false the day after', () => {
        expect(withinGrace(days(-RENEWAL_GRACE_DAYS), NOW)).toBe(true)
        expect(withinGrace(days(-(RENEWAL_GRACE_DAYS + 1)), NOW)).toBe(false)
    })

    it('is true while the term is still running', () => {
        expect(withinGrace(days(200), NOW)).toBe(true)
    })

    it('is false for perpetual access, which has nothing to renew', () => {
        expect(withinGrace(null, NOW)).toBe(false)
    })

    it('reports the last day the price is held', () => {
        expect(graceEnds(days(0))).toBe(days(RENEWAL_GRACE_DAYS))
    })
})

describe('renewalAmountCents', () => {
    it('walks the $150 pass down 150 -> 100 -> 50 and stays there', () => {
        expect(renewalAmountCents(15000, 0)).toBe(10000)
        expect(renewalAmountCents(15000, 1)).toBe(5000)
        expect(renewalAmountCents(15000, 2)).toBe(5000)
        expect(renewalAmountCents(15000, 7)).toBe(5000)
    })

    it('scales to a single masterclass, rounding to the cent', () => {
        expect(renewalAmountCents(5000, 0)).toBe(3333)
        expect(renewalAmountCents(5000, 1)).toBe(1667)
    })

    it('never falls below what Stripe will charge', () => {
        expect(renewalAmountCents(60, 1)).toBe(50)
    })

    it('returns nothing to charge for a nonsensical base', () => {
        expect(renewalAmountCents(0, 0)).toBe(0)
        expect(renewalAmountCents(-100, 0)).toBe(0)
        expect(renewalAmountCents(Number.NaN, 0)).toBe(0)
    })

    it('is a function of the original, never of the last renewal', () => {
        // The bug this exists to prevent: pricing renewal N+1 off renewal N.
        const first = renewalAmountCents(15000, 0)
        expect(renewalAmountCents(first, 1)).not.toBe(renewalAmountCents(15000, 1))
    })
})

describe('renewalNotice', () => {
    it('says nothing for most of the year', () => {
        expect(renewalNotice(days(200), NOW)).toBe('none')
        expect(renewalNotice(days(31), NOW)).toBe('none')
    })

    it('says nothing at all about perpetual access', () => {
        expect(renewalNotice(null, NOW)).toBe('none')
    })

    it('warns inside the last month', () => {
        expect(renewalNotice(days(29), NOW)).toBe('soon')
        expect(renewalNotice(days(1), NOW)).toBe('soon')
    })

    it('distinguishes ended-but-priced from lapsed', () => {
        expect(renewalNotice(days(-1), NOW)).toBe('ended')
        expect(renewalNotice(days(-RENEWAL_GRACE_DAYS), NOW)).toBe('ended')
        expect(renewalNotice(days(-(RENEWAL_GRACE_DAYS + 1)), NOW)).toBe('lapsed')
    })
})
