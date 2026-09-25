/**
 * The catalogue card's route into a masterclass's module list.
 *
 * The curriculum used to be a page-width section rendered once, for whichever
 * published course had the most modules -- so three of the four masterclasses
 * had no way to show theirs at all. It is now a dialog opened from the module
 * count on each card, which puts a control inside a horizontally scrolling,
 * auto-advancing rail. What matters is that the control is reachable and
 * properly named, and that nothing of the dialog exists until it is asked for.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CurriculumDialog from '@/components/vault-sales/CurriculumDialog'

const open = () => screen.getByRole('button', { name: 'See the modules in Colorimetry' })

const renderDialog = () =>
    render(
        <CurriculumDialog
            label="5 modules"
            openLabel="See the modules in Colorimetry"
            title="Colorimetry, module by module"
        >
            <p>5 modules. This is exactly what you&apos;ll watch.</p>
            <ol>
                <li>Your season</li>
                <li>Temperature</li>
            </ol>
        </CurriculumDialog>
    )

describe('CurriculumDialog', () => {
    it('shows the module count and says what clicking it does', () => {
        renderDialog()

        // The visible text is the count the card would have shown anyway; the
        // accessible name is what makes it a usable button.
        expect(open()).toHaveTextContent('5 modules')
        expect(open()).toHaveAttribute('aria-haspopup', 'dialog')
    })

    it('keeps the curriculum out of the page until asked', () => {
        renderDialog()

        expect(screen.queryByRole('dialog')).toBeNull()
        expect(screen.queryByText('Your season')).toBeNull()
    })

    it('opens the modules on click, under a heading naming the course', async () => {
        renderDialog()
        fireEvent.click(open())

        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveAccessibleName('Colorimetry, module by module')
        expect(screen.getByText('Your season')).toBeInTheDocument()
        expect(screen.getByText('Temperature')).toBeInTheDocument()
    })

    it('closes on Escape', async () => {
        renderDialog()
        fireEvent.click(open())
        await screen.findByRole('dialog')

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('closes from the dialog’s own close button', async () => {
        renderDialog()
        fireEvent.click(open())
        await screen.findByRole('dialog')

        fireEvent.click(screen.getByRole('button', { name: 'Close Colorimetry, module by module' }))

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })
})
