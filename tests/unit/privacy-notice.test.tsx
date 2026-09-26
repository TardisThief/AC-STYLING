/**
 * The privacy notice says what account deletion actually does.
 *
 * Since 2026-09-26 a stylist-managed wardrobe — garments, photos, lookbooks —
 * outlives the client who closes her account (migration 33), and purchase
 * records are kept, detached, for accounting (migration 32). The notice said
 * nothing was kept past the account and that photos were visible "only to you
 * and to your stylist". These pin the corrected commitments in both languages
 * so a later edit cannot quietly drop them.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PrivacyEn from '@/app/[locale]/legal/privacy/PrivacyEn'
import PrivacyEs from '@/app/[locale]/legal/privacy/PrivacyEs'

const text = (ui: React.ReactElement) => render(ui).container.textContent ?? ''

describe.each([
    ['English', () => text(<PrivacyEn />), {
        closing: 'When you close your account.',
        wardrobe: 'is kept after your account is closed',
        onRequest: 'If you would like it deleted as well',
        purchases: 'kept for accounting and tax purposes',
        visibility: 'visible only to your stylist and to the client the wardrobe belongs to',
        oldVisibility: 'visible only to you and to your stylist',
        oldAbsolute: '. No purpose in this notice will require us keeping',
    }],
    ['Spanish', () => text(<PrivacyEs />), {
        closing: 'Cuando das de baja tu cuenta.',
        wardrobe: 'se conserva después de dar de baja tu cuenta',
        onRequest: 'Si quieres que también se elimine',
        purchases: 'se conservan por motivos contables y fiscales',
        visibility: 'solo son visibles para tu estilista y para la clienta a la que pertenece el guardarropa',
        oldVisibility: 'solo son visibles para ti y para tu estilista',
        oldAbsolute: '. Ningún fin descrito en este aviso requerirá',
    }],
])('%s privacy notice', (_, notice, copy) => {
    it('says the stylist-managed wardrobe and purchase records are kept, and the wardrobe can be deleted on request', () => {
        const t = notice()
        expect(t).toContain(copy.closing)
        expect(t).toContain(copy.wardrobe)
        expect(t).toContain(copy.onRequest)
        expect(t).toContain(copy.purchases)
        expect(t).toContain(copy.visibility)
    })

    it('no longer promises what is not true', () => {
        const t = notice()
        expect(t).not.toContain(copy.oldVisibility)
        expect(t).not.toContain(copy.oldAbsolute)
    })
})
