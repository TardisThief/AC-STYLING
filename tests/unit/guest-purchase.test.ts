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
const updateUserById = vi.fn()

const admin = {
    auth: { admin: { listUsers, createUser, generateLink, updateUserById } },
} as never

beforeEach(() => {
    vi.clearAllMocks()
    listUsers.mockResolvedValue({ data: { users: [] }, error: null })
    updateUserById.mockResolvedValue({ data: {}, error: null })
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

    it('creates an account with no metadata at all when there is no name', async () => {
        createUser.mockResolvedValue({ data: { user: { id: 'new-2' } }, error: null })

        await resolveOrCreateUserByEmail(admin, 'noname@example.com')

        expect(createUser).toHaveBeenCalledWith({
            email: 'noname@example.com',
            email_confirm: true,
            user_metadata: {},
        })
    })

    // F06. This used to write `pending_password: true`, and the set-password
    // fast lane gated on it. Two things were wrong: `user_metadata` is writable
    // by the account it describes, so the subject could re-arm its own gate;
    // and nothing cleared it on the emailed recovery path, leaving the weaker
    // Stripe-session credential live for the rest of its 24 hours. The
    // authority is now a row in `purchase_claims`. Asserted explicitly so the
    // flag is not reintroduced as a convenience.
    it('never writes a client-editable pending_password marker', async () => {
        createUser.mockResolvedValue({ data: { user: { id: 'new-3' } }, error: null })

        await resolveOrCreateUserByEmail(admin, 'guest@example.com', 'Guest')

        const metadata = createUser.mock.calls[0][0].user_metadata
        expect(metadata).not.toHaveProperty('pending_password')
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

    // PAY-002 (2026-09-25 external assessment). Whether she still needs the
    // welcome email and its claim is a fact about the account — has anyone
    // ever signed in to it — not about whether this delivery created it. A
    // retry of a delivery that created the account and then failed sees
    // `created: false`, and used to send her nothing.
    it.fails('reports an existing account nobody has signed in to as still needing a way in', async () => {
        listUsers.mockResolvedValue({
            data: { users: [{ id: 'made-by-first-try', email: 'guest@example.com', email_confirmed_at: '2026-09-25T00:00:00Z', last_sign_in_at: null }] },
            error: null,
        })

        const result = await resolveOrCreateUserByEmail(admin, 'guest@example.com')

        expect(result).toMatchObject({ userId: 'made-by-first-try', created: false, needsWayIn: true })
    })

    it.fails('reports an account that has signed in as not needing one', async () => {
        listUsers.mockResolvedValue({
            data: { users: [{ id: 'regular', email: 'regular@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', last_sign_in_at: '2026-09-01T00:00:00Z' }] },
            error: null,
        })

        const result = await resolveOrCreateUserByEmail(admin, 'regular@example.com')

        expect(result).toMatchObject({ userId: 'regular', created: false, needsWayIn: false })
    })

    // SEC-001's other half. /vault/join lets anyone create an unconfirmed
    // account with a password for any address. A guest purchase attaches to
    // the existing account by email, and the welcome link then confirms it —
    // so whoever registered her address first would hold a password to the
    // account her purchase is in. Replace it before attaching anything.
    it.fails('replaces the password on an existing unconfirmed account before attaching a purchase', async () => {
        listUsers.mockResolvedValue({
            data: { users: [{ id: 'squatted', email: 'victim@example.com', email_confirmed_at: null, last_sign_in_at: null }] },
            error: null,
        })

        const result = await resolveOrCreateUserByEmail(admin, 'victim@example.com')

        expect(result).toMatchObject({ userId: 'squatted', created: false, needsWayIn: true })
        expect(updateUserById).toHaveBeenCalledWith('squatted', { password: expect.any(String) })
        expect(updateUserById.mock.calls[0][1].password.length).toBeGreaterThanOrEqual(32)
    })

    it.fails('fails the delivery when that password cannot be replaced, so Stripe retries', async () => {
        listUsers.mockResolvedValue({
            data: { users: [{ id: 'squatted', email: 'victim@example.com', email_confirmed_at: null, last_sign_in_at: null }] },
            error: null,
        })
        updateUserById.mockResolvedValue({ data: null, error: { message: 'down' } })

        expect(await resolveOrCreateUserByEmail(admin, 'victim@example.com')).toBeNull()
    })

    it('leaves the password on a confirmed account alone', async () => {
        listUsers.mockResolvedValue({
            data: { users: [{ id: 'regular', email: 'regular@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', last_sign_in_at: '2026-09-01T00:00:00Z' }] },
            error: null,
        })

        await resolveOrCreateUserByEmail(admin, 'regular@example.com')

        expect(updateUserById).not.toHaveBeenCalled()
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
