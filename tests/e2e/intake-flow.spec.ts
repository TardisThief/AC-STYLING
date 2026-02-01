import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Guest Intake Flow
 * Tests the tokenized wardrobe upload flow for guests (no login required)
 */

test.describe('Guest Intake Flow', () => {
    // This would use a real upload token from your test database
    // For now, we test the error handling with an invalid token

    test('shows error for invalid upload token', async ({ page }) => {
        await page.goto('/en/studio/intake/invalid-token-123')

        // Should show error message
        await expect(page.locator('text=/invalid|expired|not found/i')).toBeVisible({ timeout: 10000 })
    })

    test('intake page is accessible without login', async ({ page }) => {
        // Navigate to a valid intake URL structure
        const response = await page.goto('/en/studio/intake/test-token')

        // Should not redirect to login (status 200 or 404, not 3xx to /login)
        expect(response?.status()).not.toBe(302)
        expect(page.url()).not.toContain('/login')
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
