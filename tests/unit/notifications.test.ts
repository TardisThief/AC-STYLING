import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock admin client
const mockFrom = vi.fn()

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
    })),
}))

// Mock the RLS-respecting server client used by requireAdmin. Default: an
// authenticated admin caller. Tests override mockGetUser / mockRole to exercise
// the unauthorized / forbidden paths.
const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
        })),
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
        // Default to an authenticated admin caller.
        mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
        mockRole = 'admin'
    })

    describe('authorization', () => {
        it('rejects unauthenticated callers', async () => {
            mockGetUser.mockResolvedValue({ data: { user: null } })

            const result = await getAdminNotifications()

            expect(result.success).toBe(false)
            expect(result.error).toBe('Unauthorized')
        })

        it('rejects authenticated non-admin callers', async () => {
            mockRole = 'user'

            const result = await getAdminNotifications()

            expect(result.success).toBe(false)
            expect(result.error).toBe('Forbidden')
        })

        it('returns 0 unread count for non-admin callers', async () => {
            mockRole = 'user'

            const result = await getUnreadNotificationCount()

            expect(result).toBe(0)
        })

        it('refuses to mutate notifications for non-admin callers', async () => {
            mockRole = 'user'

            const result = await markAllAsRead()

            expect(result.success).toBe(false)
            expect(result.error).toBe('Forbidden')
            expect(mockFrom).not.toHaveBeenCalled()
        })
    })

    describe('getAdminNotifications', () => {
        it('returns notifications list', async () => {
            const mockNotifications = [
                { id: '1', type: 'service_booking', title: 'New Booking', status: 'unread', created_at: '2026-01-02' },
                { id: '2', type: 'sale', title: 'New Sale', status: 'read', created_at: '2026-01-01' },
            ]

            // getAdminNotifications reads two sources: admin_notifications and
            // (for the unread/all view) wardrobe_items in 'inbox' status.
            mockFrom.mockImplementation((table: string) => {
                if (table === 'wardrobe_items') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }
                }
                return {
                    select: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
                }
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
        it('returns combined count of unread notifications and inbox items', async () => {
            // Count = unread admin_notifications (5) + inbox wardrobe_items (3).
            mockFrom.mockImplementation((table: string) => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({
                    count: table === 'wardrobe_items' ? 3 : 5,
                    error: null,
                }),
            }))

            const result = await getUnreadNotificationCount()

            expect(result).toBe(8)
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
