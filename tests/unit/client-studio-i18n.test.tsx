/**
 * A Studio client's own screens speak her language (I18N-001, the part the
 * 2026-09-26 pass left for later; done 2026-09-28).
 *
 * My Studio (dashboard, measurements, lookbooks, wardrobe and its new "add a
 * photo"), the intake upload page, the Essence journal and the service-request
 * confirmation were English only, apart from a few inline ternaries on the
 * upload page. Each is rendered here under the Spanish dictionary; any English
 * string that was hardcoded before fails the test. The stylist-only branches
 * (bulk tagging, private note, boutique link, cloning) stay English and are not
 * rendered here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import es from '@/messages/es.json'

const h = vi.hoisted(() => ({
    rows: {} as Record<string, unknown[]>,
    searchParams: new URLSearchParams(),
}))

/** A supabase-js-shaped query that resolves to the rows set for its table. */
function query(table: string) {
    const result = { data: h.rows[table] ?? [], error: null }
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit']) q[m] = () => q
    q.single = async () => ({ data: (h.rows[table] ?? [])[0] ?? null, error: null })
    q.maybeSingle = q.single
    q.then = (resolve: (v: unknown) => unknown) => resolve(result)
    return q
}

vi.mock('@/utils/supabase/client', () => ({
    createClient: () => ({
        from: (table: string) => query(table),
        auth: { getUser: async () => ({ data: { user: null } }) },
        storage: { from: () => ({}) },
    }),
}))
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => h.searchParams,
    usePathname: () => '/es/vault',
}))
vi.mock('@/i18n/routing', () => ({
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/wardrobe-images', () => ({ signWardrobeItems: async (_: unknown, items: unknown[]) => items }))
vi.mock('@/app/actions/wardrobes', () => ({
    getWardrobes: vi.fn(), cloneWardrobeItem: vi.fn(), getAdminWardrobeItems: vi.fn(), updateAdminWardrobeItem: vi.fn(),
    bulkSetItemStatus: vi.fn(), getSignedUploadUrl: vi.fn(), createWardrobeItem: vi.fn(), claimWardrobe: vi.fn(),
    getMyItemUploadUrl: vi.fn(), addMyWardrobeItem: vi.fn(),
}))
vi.mock('@/app/actions/client-studio', () => ({ updateMyWardrobeItem: vi.fn(), saveMyMeasurements: vi.fn() }))
vi.mock('@/app/actions/studio', () => ({ uploadRemoteImage: vi.fn() }))
vi.mock('@/app/actions/scraper', () => ({ extractUrlMetadata: vi.fn() }))
vi.mock('@/app/actions/essence-lab', () => ({ saveEssenceResponse: vi.fn() }))
vi.mock('@/app/actions/stripe', () => ({ createCheckoutSession: vi.fn() }))
vi.mock('html2canvas', () => ({ default: vi.fn() }))

import ClientStudioDashboard from '@/components/studio/ClientStudioDashboard'
import TailorCardUser from '@/components/vault/TailorCardUser'
import VirtualWardrobe from '@/components/studio/VirtualWardrobe'
import DigitalLookbook from '@/components/studio/DigitalLookbook'
import WardrobeUploadLanding from '@/components/studio/WardrobeUploadLanding'
import EssenceJournal from '@/components/vault/EssenceJournal'
import ServicesGrid from '@/components/vault/ServicesGrid'

function inSpanish(ui: ReactElement) {
    return render(<NextIntlClientProvider locale="es" messages={es}>{ui}</NextIntlClientProvider>)
}

function expectNoEnglish(container: HTMLElement, english: string[]) {
    const text = container.textContent ?? ''
    const attrs = [...container.querySelectorAll('[placeholder],[aria-label],[title],[alt]')]
        .map((el) => ['placeholder', 'aria-label', 'title', 'alt'].map((a) => el.getAttribute(a) ?? '').join(' '))
        .join(' ')
    for (const word of english) expect(`${text} ${attrs}`, word).not.toContain(word)
}

const WARDROBE_ID = '00000000-0000-4000-8000-0000000000a1'
const OWNER_ID = '00000000-0000-4000-8000-0000000000b1'

// jsdom has none; framer-motion's whileInView (the services grid) needs one.
class NoopObserver { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver

beforeEach(() => {
    h.rows = {}
    h.searchParams = new URLSearchParams()
})

describe('My Studio in Spanish', () => {
    it('the dashboard header and tabs', async () => {
        const { container } = inSpanish(
            <ClientStudioDashboard wardrobeId={WARDROBE_ID} ownerId={OWNER_ID} initialMeasurements={{}} userName="Ana" />
        )
        expect(await screen.findByText('Estudio personal')).toBeInTheDocument()
        expect(screen.getByText('Bienvenida, Ana')).toBeInTheDocument()
        expectNoEnglish(container, ['Personal Studio', 'Welcome,', 'Wardrobe', 'Measurements'])
    })

    it('the measurements card', () => {
        const { container } = inSpanish(<TailorCardUser initialMeasurements={{}} isActiveClient />)
        expect(screen.getByText('Ficha de medidas')).toBeInTheDocument()
        expect(screen.getByText('Cintura')).toBeInTheDocument()
        expectNoEnglish(container, ["Tailor's Card", 'Waist', 'Hips', 'Shoe Size', 'These metrics', 'Your technical'])
    })

    it('the measurements card, locked', () => {
        const { container } = inSpanish(<TailorCardUser initialMeasurements={{}} isActiveClient={false} />)
        expectNoEnglish(container, ['Technical Profile', 'This card tracks', 'Unlock via Services'])
    })

    it('her lookbooks', async () => {
        h.rows.lookbooks = [{ id: 'lb1', title: 'Otoño', status: 'Published', collection_name: null, lookbook_items: [] }]
        const { container } = inSpanish(<DigitalLookbook wardrobeId={WARDROBE_ID} ownerId={OWNER_ID} isClientView />)
        expect(await screen.findByText('Colecciones')).toBeInTheDocument()
        expectNoEnglish(container, ['Collections', 'Select a lookbook', 'No collections', 'Loading'])
    })

    it('her wardrobe, an item, and the add-a-photo form', async () => {
        h.rows.wardrobe_items = [{ id: 'i1', category: 'Outerwear', status: 'Keep', brand: null, tags: [], notes: null, client_note: '', image_url: null }]
        const { container } = inSpanish(<VirtualWardrobe wardrobeId={WARDROBE_ID} ownerId={OWNER_ID} isClientView />)

        expect(await screen.findByText('Filtros')).toBeInTheDocument()
        expectNoEnglish(container, ['Filters', 'Add Item', 'Select an item', 'Outerwear', 'Donate', 'Archive'])

        // The garment card (aria-pressed), not the "Abrigos" filter chip.
        fireEvent.click(screen.getAllByRole('button', { name: /Abrigos/ }).find((b) => b.hasAttribute('aria-pressed'))!)
        await waitFor(() => expect(screen.getByText('Ficha de la prenda')).toBeInTheDocument())
        expectNoEnglish(container, ['Item Profile', 'Curation', 'Brand / Designer', 'Stylist Note', 'No notes from your stylist', 'Client Note', 'Change Image'])

        fireEvent.click(screen.getAllByRole('button', { name: /Añadir una foto/ })[0])
        await waitFor(() => expect(screen.getByText('Elige una foto')).toBeInTheDocument())
        // Her form, not the stylist's: no ingestion modes, no note "to client".
        expectNoEnglish(container, ['Curation Ingestion', 'From Boutique', 'Save from Link', 'Direct Upload', 'Note to Client'])
    })
})

describe('the intake upload page in Spanish', () => {
    it('asks her to sign in, in Spanish, before anything else', async () => {
        const { container } = inSpanish(
            <WardrobeUploadLanding wardrobe={{ id: WARDROBE_ID, owner_id: null, title: 'Armario' } as never} token="t" locale="es" />
        )
        expect(await screen.findByText('Bienvenida al AC Styling Studio')).toBeInTheDocument()
        expectNoEnglish(container, ['Welcome', 'Create Account', 'I Already Have'])
    })
})

describe('the Essence journal in Spanish', () => {
    it('empty', () => {
        const { container } = inSpanish(<EssenceJournal data={[]} />)
        expect(screen.getByText('Tu diario está vacío')).toBeInTheDocument()
        expectNoEnglish(container, ['Your Journal', 'Complete your first'])
    })

    it('with answers', () => {
        const data = [{
            masterclassId: 'mc1', masterclassTitle: 'Colorimetría',
            chapters: [{ chapterId: 'c1', chapterTitle: 'Uno', chapterSlug: 'uno', questions: [{ key: 'q1', label: '¿Qué color?', placeholder: '', value: '', updated_at: null }] }],
        }]
        const { container } = inSpanish(<EssenceJournal data={data} allMasterclasses={[{ id: 'mc1', title: 'Colorimetría' }]} />)
        expectNoEnglish(container, ['Filter by', 'All Masterclasses', 'Show Missing', 'Answered', 'End of Journal', 'Questions'])
    })
})

describe('booking a service, in Spanish', () => {
    it('the "request received" confirmation after paying', async () => {
        h.searchParams = new URLSearchParams('checkout_success=true')
        const { container } = inSpanish(<ServicesGrid sessionServices={[]} recommendedServiceId={null} />)
        expect(await screen.findByText('Solicitud recibida')).toBeInTheDocument()
        expectNoEnglish(container, ['Request Received', 'Thank you for your trust', 'She will be in touch', 'Return to Vault'])
    })
})
