/**
 * The in-Vault buy button must reach Stripe for everyone.
 *
 * The bug this pins down: `UnlockButton` used to send anyone without a session
 * to `/vault/join`, and to call `createCheckoutSession` for everyone else —
 * including a guest, who is an anonymous Supabase user and is refused by that
 * action with "User must be logged in". So the two kinds of visitor most likely
 * to be buying each hit a different dead end, and the button appeared to do
 * nothing at all.
 *
 * `isSignedIn` means a real account, not merely a session. That distinction is
 * the whole fix, so it is what these tests assert on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const createCheckoutSession = vi.fn(() => Promise.resolve({ url: 'https://stripe.test/member' }))
const createGuestCheckoutSession = vi.fn(() => Promise.resolve({ url: 'https://stripe.test/guest' }))

vi.mock('@/app/actions/stripe', () => ({
    createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...(args as [])),
    createGuestCheckoutSession: (...args: unknown[]) => createGuestCheckoutSession(...(args as [])),
}))

vi.mock('next-intl', () => ({ useLocale: () => 'es' }))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import UnlockButton from '@/components/monetization/UnlockButton'

describe('UnlockButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // The component navigates on success; jsdom would otherwise complain.
        Object.defineProperty(window, 'location', {
            value: { href: '' },
            writable: true,
        })
    })

    const props = {
        priceId: 'price_123',
        returnUrl: '/vault/foundations/masterclass/mc-1',
        label: 'Desbloquear acceso',
        comingSoonLabel: 'Próximamente',
    }

    it('sends a real account through the member checkout', async () => {
        render(<UnlockButton {...props} isSignedIn />)
        fireEvent.click(screen.getByRole('button'))

        await waitFor(() =>
            expect(createCheckoutSession).toHaveBeenCalledWith('price_123', props.returnUrl)
        )
        expect(createGuestCheckoutSession).not.toHaveBeenCalled()
    })

    it('sends a guest straight to pay-first checkout, in her own language', async () => {
        render(<UnlockButton {...props} isSignedIn={false} />)
        fireEvent.click(screen.getByRole('button'))

        await waitFor(() =>
            expect(createGuestCheckoutSession).toHaveBeenCalledWith(
                'price_123',
                props.returnUrl,
                '/es/welcome',
                'es'
            )
        )
        expect(createCheckoutSession).not.toHaveBeenCalled()
    })

    it('says so, rather than failing on click, when there is no price yet', async () => {
        render(<UnlockButton {...props} priceId={undefined} isSignedIn />)

        const button = screen.getByRole('button')
        expect(button).toBeDisabled()
        expect(button).toHaveTextContent('Próximamente')

        fireEvent.click(button)
        expect(createCheckoutSession).not.toHaveBeenCalled()
        expect(createGuestCheckoutSession).not.toHaveBeenCalled()
    })
})
