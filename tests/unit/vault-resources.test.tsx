/**
 * Resource panels in the Vault.
 *
 * Before these components existed, each chapter page hand-rolled its own
 * Resources card and the two had drifted: the courses page gated the download
 * links behind an entitlement check while the foundations page rendered the
 * real links to anyone who could load the page. The gate is the behaviour
 * worth pinning, so it cannot quietly regress the next time the markup moves.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const DICT: Record<string, string> = {
    resources: 'Resources',
    masterclassResources: 'Masterclass Resources',
    noResources: 'No resources available yet.',
    unlockToView: 'Unlock to view',
}
const translate = (key: string) => DICT[key] ?? `MISSING:${key}`

vi.mock('next-intl/server', () => ({
    getTranslations: async () => translate,
}))
vi.mock('next-intl', () => ({
    useTranslations: () => translate,
}))

import ResourcesCard from '@/components/vault/ResourcesCard'
import MasterclassResourcesButton from '@/components/vault/MasterclassResourcesButton'

const RESOURCES = [
    { name: 'Masterclass Workbook', url: 'https://cdn.example.com/workbook.pdf' },
    { name: 'Colour Chart', url: 'https://cdn.example.com/colour.pdf' },
]

describe('ResourcesCard', () => {
    it('lists every resource as a link when the viewer has access', async () => {
        render(await ResourcesCard({ resources: RESOURCES, hasAccess: true }))

        expect(screen.getByRole('link', { name: 'Masterclass Workbook' }))
            .toHaveAttribute('href', 'https://cdn.example.com/workbook.pdf')
        expect(screen.getByRole('link', { name: 'Colour Chart' })).toBeInTheDocument()
    })

    it('renders resources in the order given — masterclass first, then the module', async () => {
        render(await ResourcesCard({ resources: RESOURCES, hasAccess: true }))

        const names = screen.getAllByRole('link').map(a => a.textContent?.trim())
        expect(names).toEqual(['Masterclass Workbook', 'Colour Chart'])
    })

    it('leaks no link or filename to a viewer without access', async () => {
        render(await ResourcesCard({ resources: RESOURCES, hasAccess: false }))

        expect(screen.queryByRole('link')).toBeNull()
        expect(screen.queryByText('Masterclass Workbook')).toBeNull()
        expect(screen.queryByText('https://cdn.example.com/workbook.pdf')).toBeNull()
        expect(screen.getByText('Unlock to view')).toBeInTheDocument()
    })

    it('says so when an entitled viewer has nothing to download', async () => {
        render(await ResourcesCard({ resources: [], hasAccess: true }))

        expect(screen.getByText('No resources available yet.')).toBeInTheDocument()
        expect(screen.queryByRole('link')).toBeNull()
    })
})

describe('MasterclassResourcesButton', () => {
    it('renders nothing when the masterclass has no resources', () => {
        const { container } = render(<MasterclassResourcesButton resources={[]} />)

        expect(container).toBeEmptyDOMElement()
    })

    it('opens a dialog listing the downloads', async () => {
        render(<MasterclassResourcesButton resources={RESOURCES} />)

        // Closed until asked for: the list does not clutter the screen.
        expect(screen.queryByRole('dialog')).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: /Masterclass Resources/ }))

        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveAccessibleName('Masterclass Resources')
        expect(screen.getByRole('link', { name: 'Masterclass Workbook' }))
            .toHaveAttribute('href', 'https://cdn.example.com/workbook.pdf')
    })

    it('closes on Escape', async () => {
        render(<MasterclassResourcesButton resources={RESOURCES} />)

        fireEvent.click(screen.getByRole('button', { name: /Masterclass Resources/ }))
        await screen.findByRole('dialog')

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })
})
