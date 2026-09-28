import { test, expect } from '@playwright/test'
import { ADMIN, LEAVER, MEMBER, hasTestDatabase, signIn } from './fixtures'

/**
 * Signed-in journeys, against the seeded LOCAL test database.
 *
 * Each of these was found on the live site in the 2026-09-28 paid-path
 * rehearsal and fixed with unit tests; these run the real app, the real
 * Supabase auth and the real browser, which is where they actually broke.
 * Skipped without the test database, so `npm run test:e2e` against a dev
 * server (production data) never signs in as anyone.
 */
test.skip(!hasTestDatabase, 'needs the local test database: npm run test:e2e:local-db')

test.describe('a member who signs in with a password', () => {
    test('lands in the Vault with Profile pointing at her profile, not the signup form', async ({ page }) => {
        await signIn(page, MEMBER)
        // Before the fix this was /en/vault/join until a reload: a prefetched
        // signed-out render of the Vault layout was reused after sign-in.
        await expect(page.locator('nav a:has(svg.lucide-user)')).toHaveAttribute('href', '/en/vault/profile')
    })

    test('is not offered sign-in or the guest link on the sales page', async ({ page }) => {
        await signIn(page, MEMBER)
        await page.goto('/en/vault-access')
        await expect(page.getByRole('link', { name: 'Go to the Vault' }).first()).toBeVisible()
        await expect(page.getByRole('button', { name: 'Log in as a guest' })).toHaveCount(0)
    })

    test('is told she already has the pass instead of being sent to pay for it again', async ({ page }) => {
        await signIn(page, MEMBER)
        await page.goto('/en/vault-access')
        // The page is prerendered; "Go to the Vault" appears once the browser
        // has read her session, i.e. once the page is interactive.
        await expect(page.getByRole('link', { name: 'Go to the Vault' }).first()).toBeVisible()
        await page.getByRole('button', { name: 'Get the pass' }).click()
        await expect(page.getByText("You already have this. It's waiting in your Vault.")).toBeVisible()
        await expect(page).toHaveURL(/\/en\/vault-access/)
    })

    test('signs out to a login page that no longer knows her', async ({ page }) => {
        await signIn(page, LEAVER)
        await page.goto('/en/vault/profile')
        await page.getByRole('button', { name: /sign out/i }).click()
        await page.waitForURL(/\/en\/login/)
        await page.goto('/en/vault/profile')
        await expect(page).toHaveURL(/\/login/)
    })
})

test.describe('a visitor on the sales page', () => {
    test('is offered sign-in and the guest link', async ({ page }) => {
        await page.goto('/en/vault-access')
        await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute('href', '/en/login')
        await expect(page.getByRole('button', { name: 'Log in as a guest' })).toBeVisible()
    })
})

test.describe('an admin', () => {
    // On a phone the centred link is hidden and an icon link takes its place.
    test('sees the admin panel link, on desktop and on a phone', async ({ page }) => {
        await signIn(page, ADMIN)
        const link = page.getByRole('link', { name: 'Admin Panel' }).locator('visible=true')
        await expect(link).toHaveCount(1)
        await expect(link).toHaveAttribute('href', '/en/vault/admin')
    })

    test('a member does not', async ({ page }) => {
        await signIn(page, MEMBER)
        await expect(page.getByRole('link', { name: 'Admin Panel' })).toHaveCount(0)
    })
})
