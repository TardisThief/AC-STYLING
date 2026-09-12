import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveOrCreateUserByEmail, generateSetPasswordLink } from '@/app/lib/guest-purchase'

/**
 * These cover the failure modes that cost money rather than pixels: a buyer
 * who already has an account must not get a second one, and an unusable email
 * must fail loudly so Stripe retries instead of the sale disappearing.
 */

const listUsers = vi.fn()
const createUser = vi.fn()
const generateLink = vi.fn()

const admin = {
    auth: { admin: { listUsers, createUser, generateLink } },
} as never

beforeEach(() => {
    vi.clearAllMocks()
    listUsers.mockResolvedValue({ data: { users: [] }, error: null })
})

describe('resolveOrCreateUserByEmail', () => {
    it('reuses an existing account rather than creating a duplicate', async () => {
        listUsers.mockResolvedValue({
            data: { users: [{ id: 'existing-1', email: 'Buyer@Example.com' }] },
            error: null,
        })

        const result = await resolveOrCreateUserByEmail(admin, 'buyer@example.com')

        expect(result).toEqual({ userId: 'existing-1', created: false })
        expect(createUser).not.toHaveBeenCalled()
    })

    it('matches the existing account case-insensitively', async () => {
        listUsers.mockResolvedValue({
            data: { users: [{ id: 'existing-2', email: 'mixed@case.com' }] },
            error: null,
        })

        const result = await resolveOrCreateUserByEmail(admin, '  MIXED@Case.com ')

        expect(result).toEqual({ userId: 'existing-2', created: false })
        expect(createUser).not.toHaveBeenCalled()
    })

    it('creates a confirmed account when none exists', async () => {
        createUser.mockResolvedValue({ data: { user: { id: 'new-1' } }, error: null })

        const result = await resolveOrCreateUserByEmail(admin, 'new@example.com', 'Ada L')

        expect(result).toEqual({ userId: 'new-1', created: true })
        expect(createUser).toHaveBeenCalledWith({
            email: 'new@example.com',
            email_confirm: true,
            user_metadata: { full_name: 'Ada L' },
        })
    })

    it('recovers from a race where a parallel delivery created the user first', async () => {
        createUser.mockResolvedValue({ data: null, error: { message: 'already registered' } })
        listUsers
            .mockResolvedValueOnce({ data: { users: [] }, error: null })
            .mockResolvedValueOnce({
                data: { users: [{ id: 'raced-1', email: 'race@example.com' }] },
                error: null,
            })

        const result = await resolveOrCreateUserByEmail(admin, 'race@example.com')

        expect(result).toEqual({ userId: 'raced-1', created: false })
    })

    it('returns null for a missing or malformed email so the caller can fail loudly', async () => {
        expect(await resolveOrCreateUserByEmail(admin, null)).toBeNull()
        expect(await resolveOrCreateUserByEmail(admin, '')).toBeNull()
        expect(await resolveOrCreateUserByEmail(admin, 'No Email')).toBeNull()
        expect(createUser).not.toHaveBeenCalled()
    })

    it('returns null when creation genuinely fails', async () => {
        createUser.mockResolvedValue({ data: null, error: { message: 'boom' } })

        const result = await resolveOrCreateUserByEmail(admin, 'fail@example.com')

        expect(result).toBeNull()
    })
})

describe('generateSetPasswordLink', () => {
    it('returns the recovery action link', async () => {
        generateLink.mockResolvedValue({
            data: { properties: { action_link: 'https://link' } },
            error: null,
        })

        const link = await generateSetPasswordLink(admin, 'a@b.com', 'https://site/update-password')

        expect(link).toBe('https://link')
        expect(generateLink).toHaveBeenCalledWith({
            type: 'recovery',
            email: 'a@b.com',
            options: { redirectTo: 'https://site/update-password' },
        })
    })

    it('returns null when the link cannot be generated', async () => {
        generateLink.mockResolvedValue({ data: null, error: { message: 'nope' } })

        expect(await generateSetPasswordLink(admin, 'a@b.com', 'https://site')).toBeNull()
    })
})
