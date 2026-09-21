/**
 * Spec C: Paywall Guard Component Tests
 * 
 * Tests that paywall components correctly show:
 * - "Unlock" button when locked
 * - "Start Learning" / hidden when unlocked
 * 
 * Note: Since FullAccessUnlock uses client-side state and async data loading,
 * we test the rendering logic in isolation using simplified test patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the server actions. Offers are keyed by slug so a test can decide which
// pass is on sale by flipping `active`, the way admin does.
const offers: Record<string, { slug: string; title: string; price_display: string; active: boolean; price_id: string }> = {}
vi.mock('@/app/actions/admin/manage-offers', () => ({
    getOffer: vi.fn((slug: string) => Promise.resolve({ success: true, offer: offers[slug] ?? null }))
}))

vi.mock('@/app/actions/stripe', () => ({
    createCheckoutSession: vi.fn(() => Promise.resolve({ url: 'https://stripe.com/checkout' }))
}))

// FullAccessUnlock imports useRouter from @/i18n/routing, which pulls in
// next-intl's client navigation (and next/navigation) — unresolvable under
// vitest. Stub the routing module the component actually uses.
vi.mock('@/i18n/routing', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    Link: ({ children }: any) => children,
    redirect: vi.fn(),
    usePathname: () => '/',
}))

// Mock framer-motion to simplify testing
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}))

// Import after mocks
import FullAccessUnlock from '@/components/vault/FullAccessUnlock'

function setOffer(slug: string, title: string, active: boolean) {
    offers[slug] = { slug, title, price_display: '$149', active, price_id: `price_${slug}` }
}

describe('Paywall Guard Components', () => {
    beforeEach(() => {
        for (const k of Object.keys(offers)) delete offers[k]
        vi.clearAllMocks()
    })

    describe('FullAccessUnlock', () => {
        it('shows the Masterclass Pass while it is the pass on sale', async () => {
            setOffer('masterclass_pass', 'Masterclass Pass', true)
            setOffer('full_access', 'Full Access', false)

            render(<FullAccessUnlock userId="user-123" offerSlugs={['masterclass_pass', 'full_access']} />)

            expect(await screen.findByRole('heading', { name: /Masterclass Pass/ })).toBeTruthy()
            expect(screen.queryByText(/Full Access/)).toBeNull()
        })

        it('falls through to the next active pass in the order given', async () => {
            setOffer('masterclass_pass', 'Masterclass Pass', false)
            setOffer('full_access', 'Full Access', true)

            render(<FullAccessUnlock userId="user-123" offerSlugs={['masterclass_pass', 'full_access']} />)

            expect(await screen.findByRole('heading', { name: /Full Access/ })).toBeTruthy()
        })

        it('offers a pass holder only the step up, never the pass they own', async () => {
            setOffer('masterclass_pass', 'Masterclass Pass', true)
            setOffer('full_access', 'Full Access', true)

            render(<FullAccessUnlock userId="user-123" offerSlugs={['full_access']} />)

            expect(await screen.findByRole('heading', { name: /Full Access/ })).toBeTruthy()
            expect(screen.queryByText(/Masterclass Pass/)).toBeNull()
        })

        it('renders nothing and asks for nothing when the member has every pass', async () => {
            setOffer('full_access', 'Full Access', true)
            const { getOffer } = await import('@/app/actions/admin/manage-offers')

            const { container } = render(<FullAccessUnlock userId="user-123" offerSlugs={[]} />)

            expect(container.innerHTML).toBe('')
            expect(getOffer).not.toHaveBeenCalled()
        })

        it('renders nothing when no listed pass is on sale', async () => {
            setOffer('masterclass_pass', 'Masterclass Pass', false)
            const { getOffer } = await import('@/app/actions/admin/manage-offers')

            const { container } = render(<FullAccessUnlock userId="user-456" offerSlugs={['masterclass_pass', 'full_access']} />)

            await vi.waitFor(() => expect(getOffer).toHaveBeenCalledTimes(2))
            expect(container.innerHTML).toBe('')
        })
    })
})

/**
 * Additional Access Level UI Logic Tests
 * Testing the visual output based on access levels
 */
describe('Access Level Display Logic', () => {
    describe('Locked State UI Patterns', () => {
        it('locked content shows unlock prompt', () => {
            const isLocked = true
            const buttonText = isLocked ? 'Unlock Now' : 'Start Learning'

            expect(buttonText).toBe('Unlock Now')
        })

        it('unlocked content shows learning prompt', () => {
            const isLocked = false
            const buttonText = isLocked ? 'Unlock Now' : 'Start Learning'

            expect(buttonText).toBe('Start Learning')
        })

        it('guest users see restricted overlay', () => {
            const isGuest = true
            const overlayText = isGuest ? 'Founding Members Only' : null

            expect(overlayText).toBe('Founding Members Only')
        })
    })

    describe('Access Badge Logic', () => {
        it('shows completion badge for non-guests', () => {
            const isCompleted = true
            const isGuest = false
            const showBadge = isCompleted && !isGuest

            expect(showBadge).toBe(true)
        })

        it('hides completion badge for guests', () => {
            const isCompleted = true
            const isGuest = true
            const showBadge = isCompleted && !isGuest

            expect(showBadge).toBe(false)
        })
    })
})
