import type { Page } from '@playwright/test'

/**
 * The accounts seeded into the LOCAL test database by
 * tests/e2e/db/supabase/seed.sql. They exist nowhere else; keep the two in step.
 */
export const MEMBER = { email: 'e2e-member@example.test', password: 'e2e-member-password' }
export const ADMIN = { email: 'e2e-admin@example.test', password: 'e2e-admin-password' }
/**
 * Only for signing out: Supabase's sign-out ends every session of the account,
 * so signing out as MEMBER would sign out tests running beside it.
 */
export const LEAVER = { email: 'e2e-signout@example.test', password: 'e2e-signout-password' }

/** True when the run is against the local test database (scripts/ci/run-e2e.mjs). */
export const hasTestDatabase = Boolean(process.env.E2E_WEB_SERVER)

/** Sign in through the real login form, with a password, and land in the Vault. */
export async function signIn(page: Page, account: { email: string; password: string }) {
    await page.goto('/en/login')
    await page.getByRole('button', { name: /^password$/i }).click()
    await page.locator('input[type="email"]').fill(account.email)
    await page.locator('input[type="password"]').fill(account.password)
    await page.locator('input[type="password"]').press('Enter')
    await page.waitForURL(/\/en\/vault(\/|$|\?)/)
}
