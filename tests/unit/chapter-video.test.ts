import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * getChapterVideo is the only path to a chapter's Vimeo id after migration 09.
 * These tests pin the thing that actually matters: an unentitled viewer gets
 * nothing, and the privileged read never runs for them.
 */

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockAdminMaybeSingle = vi.fn()
const mockAdminSelect = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        rpc: mockRpc,
    })),
}))

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: mockAdminSelect,
        })),
    })),
}))

import { getChapterVideo } from '@/app/actions/vault/chapter-video'

const CHAPTER = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSelect.mockReturnValue({
        eq: vi.fn(() => ({ maybeSingle: mockAdminMaybeSingle })),
    })
    mockAdminMaybeSingle.mockResolvedValue({
        data: { video_id: '1207933620', video_id_es: '9999' },
    })
})

describe('getChapterVideo', () => {
    it('returns the ids for an entitled user', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', is_anonymous: false } } })
        mockRpc.mockResolvedValue({ data: true, error: null })

        const result = await getChapterVideo(CHAPTER)

        expect(result).toEqual({ videoId: '1207933620', videoIdEs: '9999' })
        expect(mockRpc).toHaveBeenCalledWith('check_access', {
            check_user_id: 'u1',
            check_object_id: CHAPTER,
        })
    })

    it('returns nulls when check_access says no, and never reads the column', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'u2', is_anonymous: false } } })
        mockRpc.mockResolvedValue({ data: false, error: null })

        const result = await getChapterVideo(CHAPTER)

        expect(result).toEqual({ videoId: null, videoIdEs: null })
        expect(mockAdminSelect).not.toHaveBeenCalled()
    })

    it('returns nulls for a signed-out visitor without calling check_access', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } })

        const result = await getChapterVideo(CHAPTER)

        expect(result).toEqual({ videoId: null, videoIdEs: null })
        expect(mockRpc).not.toHaveBeenCalled()
        expect(mockAdminSelect).not.toHaveBeenCalled()
    })

    it('treats an anonymous auth user as unentitled', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'guest', is_anonymous: true } } })

        const result = await getChapterVideo(CHAPTER)

        expect(result).toEqual({ videoId: null, videoIdEs: null })
        expect(mockRpc).not.toHaveBeenCalled()
    })

    it('fails closed when the access check itself errors', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'u3', is_anonymous: false } } })
        mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

        const result = await getChapterVideo(CHAPTER)

        expect(result).toEqual({ videoId: null, videoIdEs: null })
        expect(mockAdminSelect).not.toHaveBeenCalled()
    })

    it('returns nulls for an empty chapter id without touching auth', async () => {
        const result = await getChapterVideo('')

        expect(result).toEqual({ videoId: null, videoIdEs: null })
        expect(mockGetUser).not.toHaveBeenCalled()
    })
})
