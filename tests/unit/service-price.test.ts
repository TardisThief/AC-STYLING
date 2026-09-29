/**
 * The Services page shows the Spanish price to a Spanish reader when there
 * is one (migration 36), and the English text otherwise.
 */
import { describe, it, expect } from 'vitest'
import { localizedServicePrice } from '@/app/lib/service-price'

describe('localizedServicePrice', () => {
    const row = { price_display: 'From $500', price_display_es: 'Desde $500' }

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
