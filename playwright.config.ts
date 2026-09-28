import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        // E2E_BASE_URL is set by scripts/ci/run-e2e.mjs (local database, port 3100).
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile',
            use: { ...devices['iPhone 14'] },
        },
    ],

    // Against the local test database (scripts/ci/run-e2e.mjs) the runner
    // names the server and it is never reused: a server already running on a
    // developer's machine is `npm run dev`, which talks to PRODUCTION. Without
    // the runner this is the old behaviour: the dev server, reused locally.
    webServer: {
        command: process.env.E2E_WEB_SERVER ?? 'npm run dev',
        url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
        reuseExistingServer: !process.env.CI && !process.env.E2E_WEB_SERVER,
        // Server logs in the test output when running against the test
        // database, so a failure in CI shows what the server did.
        stdout: process.env.E2E_WEB_SERVER ? 'pipe' : 'ignore',
        timeout: 120000,
    },
})
