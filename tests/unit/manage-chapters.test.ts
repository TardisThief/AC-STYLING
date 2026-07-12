import { describe, it, expect, vi, beforeEach } from 'vitest'

const MASTERCLASS_UUID = '123e4567-e89b-12d3-a456-426614174000'
const CHAPTER_UUID = '223e4567-e89b-12d3-a456-426614174000'

const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'
const mockWriteFrom = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
                }
            }
            return mockWriteFrom(table)
        }),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createChapter, updateChapter } from '@/app/actions/admin/manage-chapters'

function chapterForm(overrides: Record<string, string> = {}) {
    const base: Record<string, string> = {
        slug: 'chapter-1',
        title: 'Chapter One',
        videoId: 'vid123',
        labQuestions: '[]',
        takeaways: '["a"]',
        takeawaysEs: '[]',
        resourceUrls: '[]',
    }
    const fd = new FormData()
    for (const [key, value] of Object.entries({ ...base, ...overrides })) fd.set(key, value)
    return fd
}

function insertChain() {
    const single = vi.fn().mockResolvedValue({ data: { id: CHAPTER_UUID, slug: 'chapter-1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    return { insert }
}

beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRole = 'admin'
})

describe('createChapter', () => {
    it('rejects non-admin callers', async () => {
        mockRole = 'user'

        const result = await createChapter(chapterForm())

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('requires slug, title, and video id with readable errors', async () => {
        const result = await createChapter(chapterForm({ slug: '', title: '', videoId: '' }))

        expect(result.success).toBe(false)
        expect(result.error).toContain('Slug is required')
        expect(result.error).toContain('Title is required')
        expect(result.error).toContain('Video ID is required')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('returns a friendly error instead of throwing on malformed JSON', async () => {
        const result = await createChapter(chapterForm({ takeaways: '{not json' }))

        expect(result.success).toBe(false)
        expect(result.error).toContain('Takeaways contains invalid JSON')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('inserts a fully mapped row and forces is_standalone=false under a masterclass', async () => {
        const chain = insertChain()
        mockWriteFrom.mockReturnValue(chain)

        const result = await createChapter(chapterForm({
            masterclassId: MASTERCLASS_UUID,
            isStandalone: 'true', // must be overridden by the masterclass link
            orderIndex: '4',
        }))

        expect(result.success).toBe(true)
        expect(result.chapter).toEqual({ id: CHAPTER_UUID, slug: 'chapter-1' })
        expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
            slug: 'chapter-1',
            title: 'Chapter One',
            video_id: 'vid123',
            category: 'masterclass',
            order_index: 4,
            masterclass_id: MASTERCLASS_UUID,
            is_standalone: false,
            takeaways: ['a'],
            lab_questions: [],
        }))
    })

    it('keeps the standalone toggle when no masterclass is linked', async () => {
        const chain = insertChain()
        mockWriteFrom.mockReturnValue(chain)

        await createChapter(chapterForm({ isStandalone: 'true' }))

        expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
            masterclass_id: null,
            is_standalone: true,
        }))
    })
})

describe('updateChapter', () => {
    it('rejects a malformed chapter id before writing', async () => {
        const result = await updateChapter('nope', chapterForm())

        expect(result.success).toBe(false)
        expect(result.error).toContain('Chapter id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('updates the row (with updated_at) for valid input', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        const update = vi.fn(() => ({ eq }))
        mockWriteFrom.mockReturnValue({ update })

        const result = await updateChapter(CHAPTER_UUID, chapterForm())

        expect(result.success).toBe(true)
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            slug: 'chapter-1',
            updated_at: expect.any(String),
        }))
        expect(eq).toHaveBeenCalledWith('id', CHAPTER_UUID)
    })
})
