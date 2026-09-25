/**
 * The copy that heads a masterclass's module list.
 *
 * It was once fixed, reading "Colorimetry, module by module" over a lede that
 * said "Five modules", while the code picked the course dynamically. That held
 * only while Colorimetry was the sole published course — Body Shape has six
 * modules to its five — so publishing in a different order would have captioned
 * the wrong course with the wrong count, on the page whose whole job is to be
 * trusted enough to take money.
 *
 * The same copy now heads a dialog opened from each catalogue card, so it is
 * interpolated per course on every render rather than once per page. That makes
 * these assertions more load-bearing than they were, not less.
 */

import { describe, it, expect } from 'vitest'
import { createTranslator } from 'next-intl'
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

describe('curriculum copy', () => {
    it.each([
        ['en', en],
        ['es', es],
    ])('%s names no course and no module count of its own', (_locale, messages) => {
        const curriculum = messages.VaultSales.curriculum

        expect(curriculum.title).toContain('{course}')
        expect(curriculum.lede).toContain('{count')
        // The trigger's accessible name is interpolated too: "5 modules" alone
        // does not say what the button does.
        expect(curriculum.open).toContain('{course}')

        // The specific regression: a course name baked into the copy.
        const copy = `${curriculum.title} ${curriculum.lede} ${curriculum.open}`
        for (const name of ['Colorimetry', 'Colorimetría', 'Body Shape', 'AC Method', 'Style & Essence', 'Estilo y Esencia']) {
            expect(copy).not.toContain(name)
        }
        expect(copy).not.toMatch(/\b(five|cinco)\b/i)
    })
})

describe('curriculum copy renders', () => {
    // Formatted through next-intl itself, not a hand-rolled ICU call, so this
    // exercises the same path the page uses: a malformed plural or a renamed
    // placeholder fails here rather than reaching a live heading as a literal
    // "{course}".
    // `en` is the shape of record; `es` is checked against it structurally,
    // which is the point — a Spanish file missing the key fails to compile.
    const t = (locale: string, messages: typeof en) =>
        createTranslator({ locale, messages, namespace: 'VaultSales.curriculum' })

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
