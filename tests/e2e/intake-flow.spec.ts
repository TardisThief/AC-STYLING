import { test, expect } from '@playwright/test'

/**
 * E2E Tests for the tokenized wardrobe upload flow and public route access.
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

test.describe('Public Content Access', () => {
    test('courses page is viewable without login', async ({ page }) => {
        await page.goto('/en/vault/courses')

        // Page should load (may show courses or empty state, but not redirect)
        await expect(page).toHaveURL('/en/vault/courses')
    })

    test('services page is viewable without login', async ({ page }) => {
        await page.goto('/en/vault/services')

        await expect(page).toHaveURL('/en/vault/services')
    })

    test('boutique page is viewable without login', async ({ page }) => {
        await page.goto('/en/vault/boutique')

        await expect(page).toHaveURL('/en/vault/boutique')
    })
})

test.describe('Protected Routes', () => {
    test('admin page redirects to login', async ({ page }) => {
        await page.goto('/en/vault/admin')

        // Should redirect to login or show unauthorized
        await expect(page).toHaveURL(/login|unauthorized/)
    })

    test('studio page requires authentication', async ({ page }) => {
        await page.goto('/en/vault/studio')

        // Should require login
        await expect(page).toHaveURL(/login|unauthorized/)
    })

    test('profile page requires authentication', async ({ page }) => {
        await page.goto('/en/vault/profile')

        await expect(page).toHaveURL(/login|unauthorized/)
    })
})
