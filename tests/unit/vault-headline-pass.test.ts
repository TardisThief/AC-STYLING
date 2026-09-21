/**
 * Which pass the sales page leads with.
 *
 * The launch sells the Masterclass Pass; Full Access and the Course Pass are
 * switched off in admin (offers.active) until the first standalone course
 * ships. The page must follow that switch with no code change, and every
 * string it reads for either pass must exist in both languages.
 */

import { describe, it, expect } from 'vitest'
import { createTranslator } from 'next-intl'
import { pickHeadlinePass, type VaultOffer } from '@/app/lib/vault-catalog'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

function offer(slug: string): VaultOffer {
    return {
        slug,
        title: slug,
        title_es: null,
        description: null,
        description_es: null,
        price_display: null,
        price_id: null,
    }
}

describe('pickHeadlinePass', () => {
    it('leads with the Masterclass Pass while it is the only pass on sale', () => {
        expect(pickHeadlinePass({ masterclass_pass: offer('masterclass_pass') })).toBe('masterclass_pass')
    })

    it('leads with Full Access once it is back on sale, since it includes the pass', () => {
        expect(
            pickHeadlinePass({
                masterclass_pass: offer('masterclass_pass'),
                full_access: offer('full_access'),
            })
        ).toBe('full_access')
    })

    it('ignores the Course Pass, which is never the headline', () => {
        expect(pickHeadlinePass({ course_pass: offer('course_pass') })).toBe('full_access')
    })

    it('keeps the Full Access copy when nothing is on sale', () => {
        expect(pickHeadlinePass({})).toBe('full_access')
    })
})

describe('pass copy', () => {
    const keys = ['name', 'catalogLede', 'includedBadge', 'body', 'cta', 'sticky'] as const

    for (const [locale, messages] of [['en', en], ['es', es]] as const) {
        for (const slug of ['full_access', 'masterclass_pass'] as const) {
            it(`${locale}: every ${slug} string the page reads exists`, () => {
                const t = createTranslator({ locale, messages, namespace: 'VaultSales' })
                for (const k of keys) {
                    const value = t(`pass.${slug}.${k}`)
                    expect(value).not.toContain('VaultSales.pass')
                    expect(value.length).toBeGreaterThan(0)
                }
            })
        }
    }

    it('never tells a Masterclass Pass buyer she is getting courses', () => {
        expect(en.VaultSales.pass.masterclass_pass.body).not.toMatch(/course/i)
        expect(es.VaultSales.pass.masterclass_pass.body).not.toMatch(/curso/i)
    })
})
