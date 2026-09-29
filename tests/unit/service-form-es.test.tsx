/**
 * The admin service form edits a service's Spanish text (2026-09-29).
 *
 * services.title_es, subtitle_es and description_es existed, the Services
 * page read them and the save action accepted them, but the form had no
 * fields for them, so they could never be filled in: /es/vault/services
 * showed every service in English.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ saved: [] as Record<string, unknown>[] }))
vi.mock('@/app/actions/admin/manage-services', () => ({
    upsertService: async (payload: Record<string, unknown>) => { h.saved.push(payload); return { success: true } },
}))
vi.mock('@/app/lib/upload-client', () => ({ uploadAssetWithToast: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import ServiceForm from '@/components/admin/ServiceForm'

const service = {
    id: '00000000-0000-4000-8000-00000000c0a1', title: 'Closet Detox', subtitle: 'Revamp your capsule', description: 'We go through it.',
    title_es: 'Detox de armario', subtitle_es: null, description_es: null,
    price_display: '250', price_display_es: null, price_id: null, stripe_url: null, stripe_product_id: null, image_url: null,
    type: 'session', recommendation_tags: [], active: true, order_index: 0, unlocks_studio_access: false,
    created_at: null, updated_at: null,
} as unknown as Parameters<typeof ServiceForm>[0]['service']

beforeEach(() => { h.saved = [] })

describe('ServiceForm, Spanish', () => {
    it('loads what is saved, and saves the Spanish title, subtitle and description', async () => {
        render(<ServiceForm service={service} onSuccess={vi.fn()} onCancel={vi.fn()} />)

        expect(screen.getByLabelText('Título (ES)')).toHaveValue('Detox de armario')
        fireEvent.change(screen.getByLabelText('Subtítulo (ES)'), { target: { value: 'Renueva tu cápsula' } })
        fireEvent.change(screen.getByLabelText('Descripción (ES)'), { target: { value: 'Lo revisamos juntas.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save Service' }))

        await waitFor(() => expect(h.saved).toHaveLength(1))
        expect(h.saved[0]).toMatchObject({
            title: 'Closet Detox',
            title_es: 'Detox de armario',
            subtitle_es: 'Renueva tu cápsula',
            description_es: 'Lo revisamos juntas.',
        })
    })
})
