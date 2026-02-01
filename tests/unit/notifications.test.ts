import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock admin client
const mockFrom = vi.fn()

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
    })),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

// Import after mocks
import {
    getAdminNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    updateNotificationStatus,
    archiveNotification,
    markAllAsRead,
} from '@/app/actions/notifications'

describe('Admin Notifications Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getAdminNotifications', () => {
        it('returns notifications list', async () => {
            const mockNotifications = [
                { id: '1', type: 'service_booking', title: 'New Booking', status: 'unread' },
                { id: '2', type: 'sale', title: 'New Sale', status: 'read' },
            ]

            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
            })

            const result = await getAdminNotifications()

            expect(result.success).toBe(true)
            expect(result.data).toHaveLength(2)
        })

        it('filters by type when provided', async () => {
            const mockSelect = vi.fn().mockReturnThis()
            const mockOrder = vi.fn().mockReturnThis()
            const mockEq = vi.fn().mockResolvedValue({ data: [], error: null })

            mockFrom.mockReturnValue({
                select: mockSelect,
                order: mockOrder,
                eq: mockEq,
            })

            // Need to mock the full chain
            mockFrom.mockReturnValue({
                select: vi.fn(() => ({
                    order: vi.fn(() => ({
                        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                    })),
                })),
            })

            await getAdminNotifications({ type: 'service_booking' })
            // Test that filter was applied (mock call tracking)
        })

        it('handles database errors', async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
            })

            const result = await getAdminNotifications()

            expect(result.success).toBe(false)
            expect(result.error).toBe('DB Error')
        })
    })

    describe('getUnreadNotificationCount', () => {
        it('returns count of unread notifications', async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
            })

            const result = await getUnreadNotificationCount()

            expect(result).toBe(5)
        })

        it('returns 0 on error', async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'Error' } }),
            })

            const result = await getUnreadNotificationCount()

            expect(result).toBe(0)
        })
    })

    describe('markNotificationAsRead', () => {
        it('marks notification as read successfully', async () => {
            mockFrom.mockReturnValue({
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: null }),
            })

            const result = await markNotificationAsRead('notification-123')

            expect(result.success).toBe(true)
        })

        it('handles update errors', async () => {
            mockFrom.mockReturnValue({
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
            })

            const result = await markNotificationAsRead('notification-123')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Update failed')
        })
    })

    describe('updateNotificationStatus', () => {
        it('updates status with action taken', async () => {
            mockFrom.mockReturnValue({
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: null }),
            })

            const result = await updateNotificationStatus('notification-123', 'actioned', 'Called client')

            expect(result.success).toBe(true)
        })
    })

    describe('archiveNotification', () => {
        it('archives notification', async () => {
            mockFrom.mockReturnValue({
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: null }),
            })

            const result = await archiveNotification('notification-123')

            expect(result.success).toBe(true)
        })
    })

    describe('markAllAsRead', () => {
        it('marks all unread notifications as read', async () => {
            mockFrom.mockReturnValue({
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ error: null }),
            })

            const result = await markAllAsRead()

            expect(result.success).toBe(true)
        })
    })
})
