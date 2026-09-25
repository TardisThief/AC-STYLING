/**
 * The /vault-access courses row and the guest-entry link.
 *
 * The row auto-advances only when the cards overflow, and stops for the
 * reader (pause button, reduced motion). The guest link signs in anonymously
 * and goes to the Vault, or says why it couldn't.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

const push = vi.fn()
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push }) }))

const signInAnonymously = vi.fn()
vi.mock('@/utils/supabase/client', () => ({
    createClient: () => ({ auth: { signInAnonymously } }),
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }))

import CatalogRail from '@/components/vault-sales/CatalogRail'
import GuestAccessLink from '@/components/vault-sales/GuestAccessLink'

const t = { previous: 'Previous course', next: 'Next course', pause: 'Pause auto-scroll', play: 'Resume auto-scroll' }

/** jsdom has no layout; give the track the geometry of an overflowing row. */
function fakeOverflow(scrollWidth: number, clientWidth: number) {
    const track = screen.getByRole('region', { name: 'Courses' })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: scrollWidth })
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: clientWidth })
    const first = track.querySelector('li') as HTMLElement
    Object.defineProperty(first, 'offsetWidth', { configurable: true, value: 300 })
    track.scrollTo = vi.fn() as unknown as typeof track.scrollTo
    return track
}

function renderRail() {
    return render(
        <CatalogRail label="Courses" t={t}>
            <article>One</article>
            <article>Two</article>
            <article>Three</article>
        </CatalogRail>
    )
}

describe('CatalogRail', () => {
    let remeasure: () => void = () => {}

    const setReducedMotion = (matches: boolean) => {
        window.matchMedia = vi.fn().mockReturnValue({
            matches,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }) as unknown as typeof window.matchMedia
    }

    beforeEach(() => {
        vi.useFakeTimers()
        setReducedMotion(false)
        // jsdom has no ResizeObserver; capture the callback so a test can
        // re-measure after giving the track real-looking geometry.
        globalThis.ResizeObserver = class {
            constructor(cb: () => void) { remeasure = cb }
            observe() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver
    })
    afterEach(() => vi.useRealTimers())

    /** Render, then make the row overflow: 3 cards of 300px in a 500px viewport. */
    function renderOverflowing() {
        renderRail()
        const track = fakeOverflow(900, 500)
        act(() => remeasure())
        return track
    }

    it('renders each card as a list item inside a labelled, focusable region', () => {
        renderRail()
        const region = screen.getByRole('region', { name: 'Courses' })
        expect(region.getAttribute('tabindex')).toBe('0')
        expect(region.querySelectorAll('li')).toHaveLength(3)
    })

    it('shows no controls and never moves when everything fits', () => {
        renderRail()
        const track = fakeOverflow(500, 500)
        act(() => remeasure())

        expect(screen.queryByRole('button', { name: t.next })).toBeNull()
        act(() => { vi.advanceTimersByTime(20000) })
        expect(track.scrollTo).not.toHaveBeenCalled()
    })

    it('advances one card on its own when the row overflows', () => {
        const track = renderOverflowing()

        act(() => { vi.advanceTimersByTime(5000) })

        expect(track.scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' })
    })

    it('wraps back to the first card from the end', () => {
        const track = renderOverflowing()
        track.scrollLeft = 400 // the end: 900 - 500

        act(() => { vi.advanceTimersByTime(5000) })

        expect(track.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' })
    })

    it('holds still while paused, and the button then offers to resume', () => {
        const track = renderOverflowing()

        fireEvent.click(screen.getByRole('button', { name: t.pause }))
        act(() => { vi.advanceTimersByTime(20000) })

        expect(track.scrollTo).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: t.play })).toBeTruthy()
    })

    it('does not auto-advance for a reader who prefers reduced motion', () => {
        setReducedMotion(true)
        const track = renderOverflowing()

        act(() => { vi.advanceTimersByTime(20000) })

        expect(track.scrollTo).not.toHaveBeenCalled()
        // Nothing moves, so there is nothing to pause; the arrows remain.
        expect(screen.queryByRole('button', { name: t.pause })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: t.next }))
        expect(track.scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'auto' })
    })

    it('waits after the reader scrolls it by hand', () => {
        const track = renderOverflowing()

        fireEvent.wheel(track)
        act(() => { vi.advanceTimersByTime(5000) })
        expect(track.scrollTo).not.toHaveBeenCalled()

        act(() => { vi.advanceTimersByTime(5000) })
        expect(track.scrollTo).toHaveBeenCalledTimes(1)
    })
})

describe('GuestAccessLink', () => {
    beforeEach(() => {
        push.mockReset()
        signInAnonymously.mockReset()
        toastError.mockReset()
    })

    const renderLink = () =>
        render(<GuestAccessLink label="Log in as a guest" loadingLabel="Entering the Vault…" errorLabel="Not available" />)

    it('signs in anonymously and goes to the Vault', async () => {
        signInAnonymously.mockResolvedValue({ error: null })
        renderLink()

        fireEvent.click(screen.getByRole('button', { name: 'Log in as a guest' }))

        await waitFor(() => expect(push).toHaveBeenCalledWith('/vault'))
        expect(signInAnonymously).toHaveBeenCalledTimes(1)
        expect(toastError).not.toHaveBeenCalled()
    })

    it('says so and stays on the page when guest sign-in fails', async () => {
        signInAnonymously.mockResolvedValue({ error: { message: 'Anonymous sign-ins are disabled' } })
        vi.spyOn(console, 'error').mockImplementation(() => {})
        renderLink()

        fireEvent.click(screen.getByRole('button', { name: 'Log in as a guest' }))

        await waitFor(() => expect(toastError).toHaveBeenCalledWith('Not available'))
        expect(push).not.toHaveBeenCalled()
        // Usable again, not stuck on the loading label.
        expect(screen.getByRole('button', { name: 'Log in as a guest' })).not.toBeDisabled()
    })
})
