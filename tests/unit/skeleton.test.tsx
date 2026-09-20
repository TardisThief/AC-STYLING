/**
 * Loading-placeholder semantics.
 *
 * A screen of skeleton blocks is decoration: announced naively it reads as
 * dozens of empty elements. The contract pinned here is that the placeholder
 * tree is hidden from assistive technology and the container says "loading"
 * exactly once.
 *
 * The route-level `loading.tsx` files that compose these live under `/vault`,
 * which redirects anonymous requests at the proxy, so they cannot be exercised
 * against a running server without a session.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
    SkeletonBlock,
    SkeletonCard,
    SkeletonCardGrid,
    SkeletonHeader,
    SkeletonScreen,
} from '@/components/ui/Skeleton'

describe('Skeleton', () => {
    it('announces the loading state once, through the container', () => {
        render(
            <SkeletonScreen label="Loading courses">
                <SkeletonCardGrid count={6} />
            </SkeletonScreen>
        )

        const status = screen.getByRole('status')
        expect(status.getAttribute('aria-busy')).toBe('true')
        expect(status.getAttribute('aria-live')).toBe('polite')
        expect(screen.getByText('Loading courses')).toBeTruthy()
    })

    it('hides every placeholder from assistive technology', () => {
        const { container } = render(
            <SkeletonScreen label="Loading">
                <SkeletonHeader />
                <SkeletonCardGrid count={3} />
            </SkeletonScreen>
        )

        // Everything below the live region is decoration.
        const status = container.querySelector('[role="status"]')!
        const decorative = status.querySelectorAll('div')
        expect(decorative.length).toBeGreaterThan(0)
        for (const el of Array.from(decorative)) {
            // Either hidden itself, or nested inside something already hidden.
            expect(el.closest('[aria-hidden="true"]')).not.toBeNull()
        }
    })

    it('renders the number of cards it is asked for', () => {
        const { container } = render(<SkeletonCardGrid count={4} />)
        const grid = container.firstElementChild!
        expect(grid.children.length).toBe(4)
    })

    it('carries the pulse class that globals.css disables under reduced motion', () => {
        const { container } = render(<SkeletonBlock />)
        expect(container.firstElementChild!.className).toContain('animate-pulse')
    })

    it('shapes a card as an image well plus two text lines', () => {
        const { container } = render(<SkeletonCard />)
        expect(container.firstElementChild!.children.length).toBe(3)
    })
})
