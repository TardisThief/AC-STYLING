import { test, expect } from '@playwright/test'

/**
 * E2E Tests for the tokenized wardrobe upload flow and route access.
 *
 * The "Public Content Access" block that used to live here asserted that
 * `/vault/courses`, `/vault/services` and `/vault/boutique` were viewable
 * without logging in. They are not, and were not: `proxy.ts` protects the
 * whole of `/vault`. Verified against production on 2026-09-20 — all three
 * answer 307 to `/en/login?next=…`.
 *
 * Those tests could only ever have failed, which is its own finding: the E2E
 * suite is not part of CI, so nothing noticed. A test asserting the opposite
 * of the system is worse than no test, because it makes the rest of the suite
 * untrustworthy.
 */

test.describe('Wardrobe Upload Flow', () => {
    // Invitations are wardrobe `upload_token` links minted by generateInvitation.
    // An unrecognized token must never render an invitation-shaped page: the old
    // /studio/intake route did exactly that (any string produced a plausible
    // "Welcome, <name>" screen), which is why it was removed.
    test('invalid upload token does not render an invitation page', async ({ page }) => {
        await page.goto('/en/studio/upload/invalid-token-123')

        await expect(page).not.toHaveURL(/\/studio\/upload\//)
        await expect(page.locator('text=/join the studio|upload your wardrobe/i')).toHaveCount(0)
    })
})

test.describe('Public routes', () => {
    // What is actually reachable without an account. `/vault-access` is the
    // public sales page; `/vault` is the members' library and is not.
    const publicPaths = [
        '/en/vault-access',
        '/es/vault-access',
        '/en/book',
        '/en/legal/terms',
    ]

    for (const path of publicPaths) {
        test(`${path} is reachable without logging in`, async ({ page }) => {
            const response = await page.goto(path)

            expect(response?.status()).toBe(200)
            await expect(page).toHaveURL(new RegExp(`${path}$`))
        })
    }
})

test.describe('Vault routes require authentication', () => {
    // Every one of these previously had a test, and three of them asserted the
    // opposite outcome. They are one list now so a new gated route cannot be
    // added to one group and forgotten in the other.
    const gatedPaths = [
        '/en/vault/courses',
        '/en/vault/services',
        '/en/vault/boutique',
        '/en/vault/admin',
        '/en/vault/studio',
        '/en/vault/profile',
    ]

    for (const path of gatedPaths) {
        test(`${path} redirects an anonymous visitor to login`, async ({ page }) => {
            await page.goto(path)

            await expect(page).toHaveURL(/\/login/)
        })
    }

    // `/vault` itself is the one exception, and deliberately so: an anonymous
    // visitor to the members' library is sent to the public sales page rather
    // than a login form, because they are far more likely to be a prospect
    // than a member who lost their session. Pinned because the distinction is
    // easy to "fix" into a login redirect and lose the conversion path.
    test('/en/vault sends an anonymous visitor to the sales page, not login', async ({ page }) => {
        await page.goto('/en/vault')

        await expect(page).toHaveURL(/\/vault-access/)
    })

    test('the login redirect remembers where the visitor was going', async ({ page }) => {
        // The `next` parameter is what returns someone to the page they asked
        // for after signing in. Losing it silently drops them on the dashboard.
        await page.goto('/en/vault/courses')

        await expect(page).toHaveURL(/next=%2Fen%2Fvault%2Fcourses/)
    })
})
