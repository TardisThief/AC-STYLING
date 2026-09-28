import { test, expect, type Page } from '@playwright/test'
import { MEMBER, hasTestDatabase, signIn } from './fixtures'

/**
 * No page breaks, or complains about, the Content-Security-Policy.
 *
 * The policy was Report-Only with no report endpoint, so a violation was
 * visible only in a browser console nobody was watching; Safari logged on
 * every page that the policy had no effect. This walks the main pages as a
 * visitor and as a member, and fails on any CSP message or blocked load.
 */
test.skip(!hasTestDatabase, 'needs the local test database: npm run test:e2e:local-db')

function watchCsp(page: Page) {
    const problems: string[] = []
    page.on('console', (msg) => {
        const text = msg.text()
        if (/content security policy|content-security-policy|refused to/i.test(text)) problems.push(`${page.url()}: ${text}`)
    })
    // The event the browser fires for every violation, report-only or not.
    void page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
            console.error(`Refused to load (CSP ${e.violatedDirective}): ${e.blockedURI}`)
        })
    })
    return problems
}

const PUBLIC_PAGES = ['/en', '/es', '/en/vault-access', '/es/vault-access', '/en/book', '/en/login', '/en/legal/privacy']
const MEMBER_PAGES = ['/en/vault', '/en/vault/foundations', '/en/vault/profile', '/en/vault/essence', '/en/vault/services']

test('public pages load without a CSP violation', async ({ page }) => {
    const problems = watchCsp(page)
    for (const path of PUBLIC_PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
    }
    expect(problems).toEqual([])
})

test("a member's pages load without a CSP violation", async ({ page }) => {
    const problems = watchCsp(page)
    await signIn(page, MEMBER)
    for (const path of MEMBER_PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
    }
    expect(problems).toEqual([])
})

test('the policy is enforced, not report-only', async ({ request }) => {
    const res = await request.get('/en')
    expect(res.headers()['content-security-policy'], 'enforced header').toContain("frame-ancestors 'none'")
    expect(res.headers()['content-security-policy-report-only']).toBeUndefined()
})
