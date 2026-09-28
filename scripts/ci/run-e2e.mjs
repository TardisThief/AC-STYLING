#!/usr/bin/env node
/**
 * Build the app against the LOCAL test database and run the browser tests.
 *
 *   bash scripts/ci/e2e-db.sh start      # once: local Supabase + .env.e2e
 *   node scripts/ci/run-e2e.mjs [playwright args]
 *
 * (`npm run test:e2e:local-db` does both.) CI runs the same two commands.
 *
 * The one thing this must never do is point the tests at production, which is
 * what .env.local holds. So: .env.e2e is loaded over the environment, the
 * Supabase URL must be localhost or the run stops, the app is built into its
 * own folder (.next-e2e) and served on its own port (3100), and Playwright is
 * told never to reuse a running server (playwright.config.ts).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = path.join(root, '.env.e2e');
if (!fs.existsSync(envFile)) {
    console.error('.env.e2e is missing: run `bash scripts/ci/e2e-db.sh start` first.');
    process.exit(2);
}
const e2eEnv = dotenv.parse(fs.readFileSync(envFile));

const supabaseUrl = e2eEnv.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(supabaseUrl)) {
    console.error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL is "${supabaseUrl}", not a local database.`);
    process.exit(2);
}

const PORT = 3100;
const env = {
    ...process.env,
    ...e2eEnv,
    NEXT_DIST_DIR: '.next-e2e',
    NEXT_TELEMETRY_DISABLED: '1',
    // The HTML report otherwise opens a browser, and waits, when a test fails.
    PLAYWRIGHT_HTML_OPEN: 'never',
    E2E_BASE_URL: `http://localhost:${PORT}`,
    E2E_WEB_SERVER: `npx next start -p ${PORT}`,
};

const run = (cmd, args) => {
    const r = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
    return r.status ?? 1;
};

if (!process.argv.includes('--no-build')) {
    const built = run('npx', ['next', 'build']);
    if (built !== 0) process.exit(built);
}
process.exit(run('npx', ['playwright', 'test', ...process.argv.slice(2).filter((a) => a !== '--no-build')]));
