/**
 * Which course the sales page features, and the copy that describes it.
 *
 * The heading used to be fixed copy reading "Colorimetry, module by module"
 * with a lede that said "Five modules", while the code chose the flagship
 * dynamically as whichever published course has the most modules. That held
 * only while Colorimetry was the sole published course. Body Shape and The AC
 * Method each have six modules to Colorimetry's five, so publishing in a
 * different order would have captioned the wrong course with the wrong count —
 * on the page whose whole job is to be trusted enough to take money.
 */

import { describe, it, expect } from 'vitest'
import { createTranslator } from 'next-intl'
import { pickFlagship } from '@/app/lib/vault-catalog'
import type { CatalogEntry } from '@/app/lib/vault-catalog'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

function entry(over: Partial<CatalogEntry> & { title: string }): CatalogEntry {
    return {
        kind: 'masterclass',
        id: over.title.toLowerCase().replace(/\s+/g, '-'),
        // `title` is required on the return type and `over` always carries it,
        // so the spread below is what supplies it.
        title_es: null,
        subtitle: null,
        subtitle_es: null,
        description: null,
        description_es: null,
        thumbnail_url: null,
        order_index: 0,
        price_display: null,
        runtime_minutes: null,
        is_published: true,
        available_at: null,
        price_id: null,
        modules: [],
        ...over,
    }
}

const modules = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `m${i}` })) as CatalogEntry['modules']

describe('pickFlagship', () => {
    it('picks the published course with the most modules', () => {
        const picked = pickFlagship([
            entry({ title: 'Colorimetry', modules: modules(5) }),
            entry({ title: 'Body Shape', modules: modules(6) }),
            entry({ title: 'Closet Curation', modules: modules(4) }),
        ])

        expect(picked?.title).toBe('Body Shape')
    })

    it('ignores unpublished courses however many modules they have', () => {
        const picked = pickFlagship([
            entry({ title: 'The AC Method', modules: modules(6), is_published: false }),
            entry({ title: 'Colorimetry', modules: modules(5) }),
        ])

        expect(picked?.title).toBe('Colorimetry')
    })

    it('ignores a published course with no modules yet', () => {
        const picked = pickFlagship([
            entry({ title: 'Placeholder', modules: modules(0) }),
        ])

        expect(picked).toBeUndefined()
    })

    it('breaks a tie on order_index, deterministically', () => {
        // Both have six. The lower order_index must win every time rather than
        // depending on how the rows happened to come back.
        const input = [
            entry({ title: 'Body Shape', order_index: 2, modules: modules(6) }),
            entry({ title: 'The AC Method', order_index: 4, modules: modules(6) }),
        ]

        expect(pickFlagship(input)?.title).toBe('Body Shape')
        expect(pickFlagship([...input].reverse())?.title).toBe('Body Shape')
    })

    it('returns undefined when nothing is published — the state today', () => {
        const picked = pickFlagship([
            entry({ title: 'Colorimetry', modules: modules(5), is_published: false }),
            entry({ title: 'Body Shape', modules: modules(6), is_published: false }),
        ])

        expect(picked).toBeUndefined()
    })

    it('does not mutate the caller\'s array', () => {
        // It sorts, and sorting the filtered copy is the only reason that is safe.
        const input = [
            entry({ title: 'Colorimetry', modules: modules(5) }),
            entry({ title: 'Body Shape', modules: modules(6) }),
        ]

        pickFlagship(input)

        expect(input.map((e) => e.title)).toEqual(['Colorimetry', 'Body Shape'])
    })
})

describe('flagship copy', () => {
    it.each([
        ['en', en],
        ['es', es],
    ])('%s names no course and no module count of its own', (_locale, messages) => {
        const flagship = messages.VaultSales.flagship

        expect(flagship.title).toContain('{course}')
        expect(flagship.lede).toContain('{count')

        // The specific regression: a course name baked into the copy.
        const copy = `${flagship.title} ${flagship.lede}`
        for (const name of ['Colorimetry', 'Colorimetría', 'Body Shape', 'AC Method']) {
            expect(copy).not.toContain(name)
        }
        expect(copy).not.toMatch(/\b(five|cinco)\b/i)
    })
})

describe('flagship copy renders', () => {
    // Formatted through next-intl itself, not a hand-rolled ICU call, so this
    // exercises the same path the page uses: a malformed plural or a renamed
    // placeholder fails here rather than reaching a live heading as a literal
    // "{course}".
    // `en` is the shape of record; `es` is checked against it structurally,
    // which is the point — a Spanish file missing the key fails to compile.
    const t = (locale: string, messages: typeof en) =>
        createTranslator({ locale, messages, namespace: 'VaultSales.flagship' })

    const cases: Array<[string, typeof en, string, string, string]> = [
        ['en', en, 'Body Shape', 'Body Shape, module by module', '6 modules.'],
        ['es', es, 'Forma Corporal', 'Forma Corporal, módulo por módulo', '6 módulos.'],
    ]

    it.each(cases)(
        '%s interpolates the course and the count',
        (locale, messages, course, title, lede) => {
            const tr = t(locale, messages)

            expect(tr('title', { course })).toBe(title)
            expect(tr('lede', { count: 6 })).toContain(lede)
        }
    )

    const singular: Array<[string, typeof en, string]> = [
        ['en', en, 'One module'],
        ['es', es, 'Un módulo'],
    ]

    it.each(singular)('%s uses the singular for a one-module course', (locale, messages, expected) => {
        expect(t(locale, messages)('lede', { count: 1 })).toContain(expected)
    })
})
