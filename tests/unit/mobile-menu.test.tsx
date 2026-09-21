/**
 * Mobile menu keyboard behaviour (F14).
 *
 * The menu is a full-screen overlay, so while it is open it is modal whether
 * or not it is called a dialog. It previously had none of what that implies:
 * Escape did nothing, Tab walked off into the page behind it, and closing
 * dropped focus back to the top of the document. Someone navigating by
 * keyboard could open it and not get out.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const dict: Record<string, string> = {
            about: 'About',
            services: 'Services',
            contact: 'Contact',
            menuLabel: 'Main menu',
        }
        return dict[key] ?? key
    },
}))

vi.mock('@/i18n/routing', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>{children}</a>
    ),
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => '/',
}))

// framer-motion's animated elements must still forward refs and props, since
// the focus trap reads the panel through a ref.
vi.mock('framer-motion', async () => {
    const React = await vi.importActual<typeof import('react')>('react')
    const passthrough = (tag: string) => {
        const Animated = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
            const { children, initial, animate, exit, transition, whileHover, whileTap, ...rest } = props
            void initial; void animate; void exit; void transition; void whileHover; void whileTap
            return React.createElement(tag, { ...rest, ref }, children as React.ReactNode)
        })
        // Named so the react/display-name rule is satisfied, and so a failure
        // message points at the element rather than at "ForwardRef".
        Animated.displayName = `motion.${tag}`
        return Animated
    }
    // Cached per tag on purpose. Returning a fresh component from the proxy on
    // every property access makes `motion.nav` a different type each render,
    // so React unmounts and remounts the whole subtree — which silently
    // invalidates any node reference a test is holding, and looks exactly like
    // a focus bug in the component under test. It is not.
    const cache = new Map<string, unknown>()
    return {
        motion: new Proxy({}, {
            get: (_t, tag: string) => {
                if (!cache.has(tag)) cache.set(tag, passthrough(tag))
                return cache.get(tag)
            },
        }),
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    }
})

vi.mock('@/components/LanguageSwitcher', () => ({
    default: () => <button type="button">ES</button>,
}))

import Navbar from '@/components/Navbar'

const openMenu = () => {
    const toggle = screen.getByRole('button', { name: /open menu/i })
    fireEvent.click(toggle)
    return toggle
}

describe('mobile menu', () => {
    beforeEach(() => vi.clearAllMocks())

    it('is announced as a modal dialog with a name', async () => {
        render(<Navbar />)
        openMenu()

        const dialog = await screen.findByRole('dialog')
        expect(dialog.getAttribute('aria-modal')).toBe('true')
        expect(dialog).toHaveAccessibleName('Main menu')
    })

    it('reports its state on the toggle', () => {
        render(<Navbar />)
        const toggle = screen.getByRole('button', { name: /open menu/i })
        expect(toggle.getAttribute('aria-expanded')).toBe('false')

        fireEvent.click(toggle)
        expect(screen.getByRole('button', { name: /close menu/i }).getAttribute('aria-expanded')).toBe('true')
    })

    it('closes on Escape', async () => {
        render(<Navbar />)
        openMenu()
        await screen.findByRole('dialog')

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('moves focus into the overlay when it opens', async () => {
        render(<Navbar />)
        openMenu()

        const dialog = await screen.findByRole('dialog')
        // Otherwise the first Tab lands on whatever is behind the overlay.
        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    })

    it('returns focus to the control that opened it', async () => {
        render(<Navbar />)
        const toggle = openMenu()
        await screen.findByRole('dialog')

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => expect(document.activeElement).toBe(toggle))
    })

    it('wraps Tab at the end of the overlay instead of escaping it', async () => {
        render(<Navbar />)
        openMenu()
        const dialog = await screen.findByRole('dialog')

        const items = Array.from(
            dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
        )
        expect(items.length).toBeGreaterThan(1)

        items[items.length - 1].focus()
        fireEvent.keyDown(document, { key: 'Tab' })

        await waitFor(() => expect(document.activeElement).toBe(items[0]))
    })
})
