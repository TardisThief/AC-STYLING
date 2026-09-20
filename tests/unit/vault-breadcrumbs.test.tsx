/**
 * Vault breadcrumb semantics.
 *
 * These render only on gated `/vault/*` routes, which redirect anonymous
 * requests at the proxy — so they cannot be exercised against a running server
 * without a session. The behaviour they exist to provide is pinned here
 * instead: the trail names where you are, every ancestor is a link, and the
 * page you are on is not.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

// The component uses the locale-aware Link from @/i18n/routing, which pulls in
// next-intl's client navigation and does not resolve under vitest.
vi.mock('@/i18n/routing', () => ({
    Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => '/',
    redirect: vi.fn(),
}))

// Keys resolve to themselves plus a marker, so a missing key is visible in the
// assertion rather than silently rendering as empty text.
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const dict: Record<string, string> = {
            label: 'Breadcrumb',
            vault: 'The Vault',
            courses: 'Courses',
            foundations: 'Foundations',
            masterclass: 'Masterclass',
            essenceLab: 'Essence Lab',
        }
        return dict[key] ?? `MISSING:${key}`
    },
}))

import VaultBreadcrumbs from '@/components/vault/VaultBreadcrumbs'

describe('VaultBreadcrumbs', () => {
    it('is a labelled navigation landmark containing an ordered list', () => {
        render(<VaultBreadcrumbs trail={[{ key: 'courses', href: '/vault/courses' }, { label: 'Colour' }]} />)

        const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
        expect(within(nav).getByRole('list')).toBeTruthy()
    })

    it('always roots the trail at the Vault without the caller supplying it', () => {
        render(<VaultBreadcrumbs trail={[{ key: 'courses', href: '/vault/courses' }, { label: 'Colour' }]} />)

        const root = screen.getByRole('link', { name: 'The Vault' })
        expect(root.getAttribute('href')).toBe('/vault')
    })

    it('links every ancestor and leaves the current page as plain text', () => {
        render(
            <VaultBreadcrumbs
                trail={[
                    { key: 'courses', href: '/vault/courses' },
                    { label: 'Colour Analysis', href: '/vault/courses/colour' },
                    { key: 'essenceLab' },
                ]}
            />
        )

        expect(screen.getByRole('link', { name: 'Courses' })).toBeTruthy()
        expect(screen.getByRole('link', { name: 'Colour Analysis' })).toBeTruthy()
        // The last crumb is where the reader already is, so it is not a link.
        expect(screen.queryByRole('link', { name: 'Essence Lab' })).toBeNull()
        expect(screen.getByText('Essence Lab')).toBeTruthy()
    })

    it('marks the last crumb as the current page for assistive technology', () => {
        render(<VaultBreadcrumbs trail={[{ key: 'foundations', href: '/vault/foundations' }, { label: 'Silhouette' }]} />)

        expect(screen.getByText('Silhouette').getAttribute('aria-current')).toBe('page')
        expect(screen.getByText('Foundations').getAttribute('aria-current')).toBeNull()
    })

    it('renders database titles verbatim rather than through the message catalogue', () => {
        // A chapter called "courses" must not be mistaken for the `courses` key.
        render(<VaultBreadcrumbs trail={[{ key: 'foundations', href: '/vault/foundations' }, { label: 'courses' }]} />)

        expect(screen.getByText('courses')).toBeTruthy()
        expect(screen.queryByText('MISSING:courses')).toBeNull()
    })

    it('renders a trail with no ancestors at all', () => {
        render(<VaultBreadcrumbs trail={[{ label: 'Orphan' }]} />)

        // The Vault root stays a link because it is not the last crumb.
        expect(screen.getByRole('link', { name: 'The Vault' })).toBeTruthy()
        expect(screen.getByText('Orphan').getAttribute('aria-current')).toBe('page')
    })
})
