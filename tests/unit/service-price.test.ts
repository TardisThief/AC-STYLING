/**
 * The Services page shows a service in the reader's language: each Spanish
 * field when it is filled in (migration 36 for the price; the admin form's
 * Spanish title, subtitle and description since 2026-09-29), English otherwise.
 */
import { describe, it, expect } from 'vitest'
import { localizeService, localizedServicePrice } from '@/app/lib/service-price'

const row = {
    id: 's1',
    title: 'Closet Detox', title_es: 'Detox de armario',
    subtitle: 'Revamp your capsule', subtitle_es: 'Renueva tu cápsula',
    description: 'We go through it together.', description_es: 'Lo revisamos juntas.',
    price_display: 'From $500', price_display_es: 'Desde $500',
}

describe('localizedServicePrice', () => {
    it('Spanish reader, Spanish price set: the Spanish price', () => {
        expect(localizedServicePrice(row, 'es')).toBe('Desde $500')
    })

    it('English reader: the English price', () => {
        expect(localizedServicePrice(row, 'en')).toBe('From $500')
    })

    it('Spanish reader, no Spanish price (empty or blank): the English one', () => {
        expect(localizedServicePrice({ ...row, price_display_es: null }, 'es')).toBe('From $500')
        expect(localizedServicePrice({ ...row, price_display_es: '  ' }, 'es')).toBe('From $500')
    })
})

describe('localizeService', () => {
    it('gives a Spanish reader every Spanish field', () => {
        expect(localizeService(row, 'es')).toMatchObject({
            title: 'Detox de armario', subtitle: 'Renueva tu cápsula', description: 'Lo revisamos juntas.', price_display: 'Desde $500',
        })
    })

    it('falls back field by field, and leaves the rest of the row alone', () => {
        const partial = { ...row, title_es: 'Detox de armario', subtitle_es: null, description_es: '', price_display_es: null }
        expect(localizeService(partial, 'es')).toMatchObject({
            id: 's1', title: 'Detox de armario', subtitle: 'Revamp your capsule', description: 'We go through it together.', price_display: 'From $500',
        })
    })

    it('gives an English reader the English fields', () => {
        expect(localizeService(row, 'en')).toMatchObject({ title: 'Closet Detox', subtitle: 'Revamp your capsule' })
    })
})
