/**
 * Modal / ConfirmDialog accessibility tests.
 *
 * The Studio previously hand-rolled five separate modals, none of which had a
 * dialog role, a focus trap, or an Escape handler, and used native confirm()
 * for destructive actions. These components replace all of that, so the
 * behaviour they exist to guarantee is pinned here.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

describe('Modal', () => {
    it('exposes dialog semantics and is named by its title', async () => {
        render(
            <Modal isOpen onClose={() => { }} title="Create New Wardrobe">
                <p>body</p>
            </Modal>
        )

        const dialog = await screen.findByRole('dialog')
        expect(dialog.getAttribute('aria-modal')).toBe('true')
        expect(dialog).toHaveAccessibleName('Create New Wardrobe')
    })

    it('closes on Escape', async () => {
        const onClose = vi.fn()
        render(<Modal isOpen onClose={onClose} title="Archive Manager"><button>inner</button></Modal>)

        await screen.findByRole('dialog')
        fireEvent.keyDown(document, { key: 'Escape' })

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes when the backdrop is clicked but not when the panel is', async () => {
        const onClose = vi.fn()
        const { container } = render(
            <Modal isOpen onClose={onClose} title="Archive Manager"><p>panel body</p></Modal>
        )

        fireEvent.click(screen.getByText('panel body'))
        expect(onClose).not.toHaveBeenCalled()

        // The backdrop is the outermost element the modal renders.
        fireEvent.click(container.firstElementChild as Element)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('moves focus into the dialog when opened', async () => {
        render(
            <Modal isOpen onClose={() => { }} title="Create New Wardrobe">
                <button>first action</button>
            </Modal>
        )

        // The close button is the first focusable element in the panel.
        await waitFor(() =>
            expect(screen.getByRole('button', { name: /close create new wardrobe/i })).toHaveFocus()
        )
    })

    it('wraps focus at both ends rather than letting Tab escape to the page behind', async () => {
        render(
            <Modal isOpen onClose={() => { }} title="Create New Wardrobe">
                <button>only action</button>
            </Modal>
        )

        const close = await screen.findByRole('button', { name: /close create new wardrobe/i })
        const action = screen.getByRole('button', { name: 'only action' })
        await waitFor(() => expect(close).toHaveFocus())

        // Tab off the last element wraps to the first.
        action.focus()
        fireEvent.keyDown(document, { key: 'Tab' })
        expect(close).toHaveFocus()

        // Shift+Tab off the first element wraps to the last.
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
        expect(action).toHaveFocus()
    })

    it('restores focus to the trigger when it closes', async () => {
        const trigger = document.createElement('button')
        trigger.textContent = 'open'
        document.body.appendChild(trigger)
        trigger.focus()

        const { rerender } = render(
            <Modal isOpen onClose={() => { }} title="Create New Wardrobe"><button>inner</button></Modal>
        )
        await waitFor(() =>
            expect(screen.getByRole('button', { name: /close create new wardrobe/i })).toHaveFocus()
        )

        rerender(
            <Modal isOpen={false} onClose={() => { }} title="Create New Wardrobe"><button>inner</button></Modal>
        )
        await waitFor(() => expect(trigger).toHaveFocus())

        trigger.remove()
    })

    it('renders nothing when closed', () => {
        render(<Modal isOpen={false} onClose={() => { }} title="Create New Wardrobe"><p>hidden</p></Modal>)
        expect(screen.queryByRole('dialog')).toBeNull()
    })
})

describe('ConfirmDialog', () => {
    it('names the consequence and only acts on confirm', async () => {
        const onConfirm = vi.fn()
        const onCancel = vi.fn()

        render(
            <ConfirmDialog
                isOpen
                onCancel={onCancel}
                onConfirm={onConfirm}
                title="Delete item"
                body="This removes the item permanently."
                confirmLabel="Delete"
                destructive
            />
        )

        expect(await screen.findByText('This removes the item permanently.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onCancel).toHaveBeenCalledTimes(1)
        expect(onConfirm).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    })

    it('is dismissible with Escape, so a destructive prompt is never a trap', async () => {
        const onCancel = vi.fn()

        render(
            <ConfirmDialog
                isOpen
                onCancel={onCancel}
                onConfirm={() => { }}
                title="Delete wardrobe permanently"
                body="Cannot be undone."
                destructive
            />
        )

        await screen.findByRole('dialog')
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onCancel).toHaveBeenCalledTimes(1)
    })
})
