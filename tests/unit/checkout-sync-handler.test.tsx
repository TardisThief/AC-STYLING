/**
 * The toast after checkout says what actually happened.
 *
 * It said "Purchase Verified! Content Unlocked." whenever the restore call did
 * not error — including when it found nothing at all, so a buyer whose
 * purchase had not landed was told it had (2026-09-25 external assessment,
 * UX-002).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const { sync, toast } = vi.hoisted(() => ({
    sync: vi.fn(),
    toast: {
        loading: vi.fn(() => 'toast-id'),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@/app/actions/commerce', () => ({ syncStripePurchases: sync }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams('checkout_success=true'),
    useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/en/vault/courses',
}))

import CheckoutSyncHandler from '@/components/monetization/CheckoutSyncHandler'

beforeEach(() => vi.clearAllMocks())

describe('CheckoutSyncHandler', () => {
    it('does not claim content is unlocked when nothing was found', async () => {
        sync.mockResolvedValue({ success: true, restored: 0, settled: 0, pending: 0, message: 'No new purchases found to restore.' })

        render(<CheckoutSyncHandler />)

        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('notFound', { id: 'toast-id' }))
        expect(toast.success).not.toHaveBeenCalled()
    })

    it('says unlocked when the webhook had already granted it', async () => {
        sync.mockResolvedValue({ success: true, restored: 0, settled: 1, pending: 0, message: '' })

        render(<CheckoutSyncHandler />)

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('unlocked', { id: 'toast-id' }))
    })

    it('says it is still being set up while another run owns the grant', async () => {
        sync.mockResolvedValue({ success: true, restored: 0, settled: 0, pending: 1, message: '' })

        render(<CheckoutSyncHandler />)

        await waitFor(() => expect(toast.info).toHaveBeenCalledWith('pending', { id: 'toast-id' }))
        expect(toast.success).not.toHaveBeenCalled()
    })
})
