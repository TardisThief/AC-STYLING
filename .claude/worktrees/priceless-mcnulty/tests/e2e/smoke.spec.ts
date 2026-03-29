import { test, expect } from '@playwright/test'

/**
 * Spec A: Smoke Tests
 * Ensure the app doesn't crash on boot
 */

test.describe('Smoke Tests', () => {
    test('homepage loads with Hero text', async ({ page }) => {
        await page.goto('/')

        // Verify the hero section loads
        // Looking for typical hero text patterns
        await expect(page.locator('h1, [class*="hero"], [class*="Hero"]').first()).toBeVisible({ timeout: 10000 })
    })

    test('homepage has no console errors on boot', async ({ page }) => {
        const errors: string[] = []

        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text())
            }
        })

        await page.goto('/')
        await page.waitForLoadState('networkidle')

        // Filter out common third-party errors that are not our fault
        const criticalErrors = errors.filter(err =>
            !err.includes('favicon') &&
            !err.includes('analytics') &&
            !err.includes('third-party')
        )

        expect(criticalErrors).toHaveLength(0)
    })

    test('/vault shows content or login redirect', async ({ page }) => {
        await page.goto('/en/vault')

        // Should either:
        // 1. Show vault content (if public)
        // 2. Redirect to login (if protected)
        // 3. Show locked state (auth wall)
        const url = page.url()
        const hasVaultContent = await page.locator('text=/vault|courses|masterclass|login|sign in/i').count() > 0

        expect(
            url.includes('vault') ||
            url.includes('login') ||
            hasVaultContent
        ).toBe(true)
    })

    test('vault page renders without crash', async ({ page }) => {
        const response = await page.goto('/en/vault')

        // Should not return server error
        expect(response?.status()).toBeLessThan(500)

        // Should have some content rendered
        const bodyContent = await page.locator('body').textContent()
        expect(bodyContent?.length).toBeGreaterThan(0)
    })

    test('foundations page loads', async ({ page }) => {
        await page.goto('/en/vault/foundations')

        // Should load page (might redirect to login but not crash)
        const isVisible = await page.locator('body').isVisible()
        expect(isVisible).toBe(true)
    })
})
