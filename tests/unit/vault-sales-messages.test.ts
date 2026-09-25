/**
 * Every message key the sales page asks for must exist, in both languages.
 *
 * next-intl does not throw on a missing key: it renders the key path. So
 * renaming `included.lifetime` to `included.term` without updating the list
 * that reads it put the literal string "VaultSales.included.lifetime" at the
 * top of What's included on the live site, and silently dropped the bullet
 * explaining the renewal ladder — the one thing on that page a buyer most
 * needs to see. Types did not catch it, the build did not catch it, and 571
 * tests did not catch it.
 *
 * The page builds some keys from `as const` arrays, so those are read out of
 * the source rather than restated here. Restating them would let the two drift
 * apart, which is the exact failure this exists to prevent.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import en from '@/messages/en.json'
import es from '@/messages/es.json'

const SOURCE = resolve(process.cwd(), 'app/[locale]/vault-access/page.tsx')
const src = readFileSync(SOURCE, 'utf8')

const lookup = (messages: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>(
        (node, part) =>
            node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        messages,
    )

/**
 * Pull the elements out of the `as const` array nearest to `anchor`.
 *
 * Nearest in either direction: the page declares `faqKeys` before using it but
 * writes the other two arrays inline, immediately above the `t()` call that
 * reads them.
 */
function constArrayNear(anchor: string): string[] {
    const at = src.indexOf(anchor)
    expect(at, `anchor not found in the page: ${anchor}`).toBeGreaterThan(-1)

    const arrays = [...src.matchAll(/\[([^\]]*?)\] as const/g)]
    expect(arrays.length, 'no "as const" arrays in the page at all').toBeGreaterThan(0)

    const nearest = arrays.reduce((best, m) =>
        Math.abs(m.index! - at) < Math.abs(best.index! - at) ? m : best)

    return [...nearest[1].matchAll(/"([^"]+)"/g)].map(m => m[1])
}

/**
 * The file has two translators both called `t`: `generateMetadata` opens one on
 * `VaultSales.meta`, and the page itself opens another on `VaultSales`. Split
 * the source between them so each key is checked against the namespace it is
 * actually resolved in.
 */
const bodyStart = src.indexOf('namespace: "VaultSales" }')
expect(bodyStart, 'the page no longer opens a VaultSales translator').toBeGreaterThan(-1)

/** Keys written out in full, e.g. t("offer.renewalNote") and t.raw("catalog.availableOn"). */
const keysIn = (text: string) =>
    [...text.matchAll(/\bt(?:\.raw)?\(\s*"([^"]+)"/g)].map(m => m[1])

const metaKeys = keysIn(src.slice(0, bodyStart))
const directKeys = keysIn(src.slice(bodyStart))

/**
 * Keys the page assembles from an array and a prefix. The pairing is stated
 * here because only a human can see it; the array contents are not.
 */
const dynamicGroups: Array<{ what: string; prefix: string; keys: string[] }> = [
    { what: "the mirror list", prefix: 'mirror.', keys: constArrayNear('mirror.${k}') },
    { what: "What's included", prefix: 'included.', keys: constArrayNear('included.${k}') },
    { what: 'the FAQ', prefix: 'faq.q', keys: constArrayNear('const faqKeys') },
]

describe('VaultSales messages', () => {
    it('finds the keys the page writes out in full', () => {
        expect(directKeys.length).toBeGreaterThan(20)
        for (const key of directKeys) {
            expect(lookup(en.VaultSales, key), `missing from en.json: VaultSales.${key}`).toBeTypeOf('string')
            expect(lookup(es.VaultSales, key), `missing from es.json: VaultSales.${key}`).toBeTypeOf('string')
        }
    })

    it('finds the keys generateMetadata asks for', () => {
        expect(metaKeys.length).toBeGreaterThan(0)
        for (const key of metaKeys) {
            expect(lookup(en.VaultSales.meta, key), `missing from en.json: VaultSales.meta.${key}`).toBeTypeOf('string')
            expect(lookup(es.VaultSales.meta, key), `missing from es.json: VaultSales.meta.${key}`).toBeTypeOf('string')
        }
    })

    for (const { what, prefix, keys } of dynamicGroups) {
        it(`finds every key ${what} builds`, () => {
            expect(keys.length).toBeGreaterThan(0)
            for (const k of keys) {
                // The FAQ builds two keys per entry, q<n> and a<n>.
                const paths = prefix === 'faq.q' ? [`faq.q${k}`, `faq.a${k}`] : [`${prefix}${k}`]
                for (const path of paths) {
                    expect(lookup(en.VaultSales, path), `missing from en.json: VaultSales.${path}`).toBeTypeOf('string')
                    expect(lookup(es.VaultSales, path), `missing from es.json: VaultSales.${path}`).toBeTypeOf('string')
                }
            }
        })
    }

    it('states the term and the renewal price somewhere on the page', () => {
        // Not just "a key exists": both have to actually be rendered. The
        // ladder was missing from the live site for a day, and the list still
        // read "Lifetime access" until the term shipped.
        //
        // Deliberately indifferent to where each one sits. `term` is a bullet
        // in What's included and `renewal` is a footnote under the founding
        // note, but that is a layout decision and this test should not have an
        // opinion on it -- only that neither can quietly disappear again.
        const included = constArrayNear('included.${k}')
        expect(included).toContain('term')
        expect(included).not.toContain('lifetime')
        expect([...included.map(k => `included.${k}`), ...directKeys]).toContain('included.renewal')
    })

    it('keeps the two languages structurally identical', () => {
        const paths = (node: unknown, at = ''): string[] =>
            node && typeof node === 'object' && !Array.isArray(node)
                ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
                      paths(v, at ? `${at}.${k}` : k))
                : [at]

        expect(paths(es.VaultSales).sort()).toEqual(paths(en.VaultSales).sort())
    })
})
