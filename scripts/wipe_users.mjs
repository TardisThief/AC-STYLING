// Wipe every non-admin user, to start testing from scratch.
//
// DRY RUN BY DEFAULT. Nothing is deleted unless --commit is given, and --commit
// also requires a fresh snapshot that includes auth.users. EVERY run, dry or
// not, needs --confirm-project <ref>: the dry run executes the real deletes
// against the real database before rolling them back, so an accidental
// invocation must not reach it. The logic lives in scripts/wipe/wipe-core.mjs
// and is tested against the live schema in tests/integration/wipe-users.test.ts.
//
//   1. npm run db:snapshot -- --tag pre-wipe
//   2. node scripts/wipe_users.mjs --confirm-project <ref> [--keep a@x.com,b@y.com] [--clear-logs]
//        -> prints who goes, who stays, and exactly how many rows per table
//           (it runs the real deletes, then rolls them back)
//   3. node scripts/wipe_users.mjs <same flags> --commit --snapshot backups/pre-wipe--<stamp>
//
// Flags:
//   --keep <emails>                  comma-separated accounts to keep (admins are always kept)
//   --clear-logs                     also empty webhook_events, stripe_processed_events,
//                                    rate_limits and payment-review notices (they carry
//                                    checkout emails, so a privacy reset wants this)
//   --include-ownerless-wardrobes    also delete wardrobes with no owner (guest intake
//                                    never claimed, or admin-held projects)
//   --resume-storage <file>          only (re)run the file deletions from a saved plan
//
// Keeps: admins, --keep accounts, and all catalog content.
// NOT touched: Stripe. A wiped person who signs up again with the same email
// and presses Restore gets back any PAID session of that email from the
// Stripe account the app's keys point at (the last 100 sessions).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { applyWipe, planWipe, tableCounts, wipeStorage } from './wipe/wipe-core.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const arg = name => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
};
const fail = message => { console.error(`\n${message}`); process.exit(1); };

for (const key of ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[key]) fail(`${key} is missing from .env.local`);
}

const commit = flag('commit');
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
}).storage;

// Typed, not defaulted, and required for the dry run too: running this at all
// takes a deliberate, visible choice of database.
if (arg('confirm-project') !== projectRef) {
    fail(`Every run needs --confirm-project ${projectRef} (the project in NEXT_PUBLIC_SUPABASE_URL).`);
}
if (!process.env.DATABASE_URL.includes(projectRef)) {
    fail(`DATABASE_URL does not point at project ${projectRef}. Refusing to touch a different database.`);
}

// ---- storage-only resume ---------------------------------------------------
const resume = arg('resume-storage');
if (resume) {
    const saved = JSON.parse(fs.readFileSync(resume, 'utf8'));
    if (saved.project !== projectRef) fail(`${resume} was written for project ${saved.project}, not ${projectRef}.`);
    const files = await wipeStorage(storage, saved.storageFolders, { commit });
    console.log(`Storage ${commit ? 'removed' : 'to remove'}:`, files);
    process.exit(0);
}

if (commit) {
    const dir = arg('snapshot');
    if (!dir) fail('--commit needs --snapshot <dir> from `npm run db:snapshot -- --tag pre-wipe`.');
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) fail(`${manifestPath} not found.`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const ageHours = (Date.now() - new Date(manifest.taken_at).getTime()) / 36e5;
    if (!(ageHours < 24)) fail(`Snapshot ${dir} is ${ageHours.toFixed(1)}h old. Take a fresh one.`);
    // A snapshot without auth.users cannot bring back a single login.
    if (manifest.database?.auth_mode !== 'full') {
        fail(`Snapshot ${dir} does not include the auth schema (auth_mode=${manifest.database?.auth_mode}). Refusing.`);
    }
}

// ---- database ----------------------------------------------------------------
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const query = (sql, params) => db.query(sql, params);
const planFile = path.join('backups', `wipe-storage-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
let result;

try {
    await db.connect();
    await db.query('BEGIN');
    await db.query("SET LOCAL statement_timeout = '120s'");
    await db.query("SET LOCAL lock_timeout = '10s'");

    const keepEmails = (arg('keep') ?? '').split(',').filter(Boolean);
    const plan = await planWipe(query, { keepEmails });

    console.log(`Project ${projectRef} — ${commit ? 'COMMIT' : 'DRY RUN (rolled back)'}\n`);
    console.log(`Keeping ${plan.kept.length}:`);
    for (const u of plan.kept) console.log(`  ${u.role === 'admin' ? 'admin' : 'kept '}  ${u.email}`);
    console.log(`\nWiping ${plan.wiped.length}:`);
    for (const u of plan.wiped) console.log(`         ${u.email ?? u.id}`);

    const before = await tableCounts(query);
    result = await applyWipe(query, plan, {
        clearLogs: flag('clear-logs'),
        includeOwnerlessWardrobes: flag('include-ownerless-wardrobes'),
    });
    const after = await tableCounts(query);

    console.log('\nRows removed per table:');
    for (const table of Object.keys(before)) {
        const gone = before[table] - after[table];
        if (gone) console.log(`  ${table.padEnd(28)} ${String(gone).padStart(6)}   (${after[table]} left)`);
    }
    if (!flag('clear-logs') && after.webhook_events) {
        console.log(`\n  webhook_events keeps ${after.webhook_events} rows, which include checkout emails. --clear-logs empties them.`);
    }

    // The storage plan is written BEFORE the commit: once the users are gone
    // their ids cannot be recovered, and neither could the folder list if the
    // process died between the commit and writing it.
    if (commit) {
        fs.mkdirSync('backups', { recursive: true });
        fs.writeFileSync(planFile, JSON.stringify({ project: projectRef, storageFolders: result.storageFolders }, null, 2));
    }

    await db.query(commit ? 'COMMIT' : 'ROLLBACK');
} catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    await db.end().catch(() => {});
    fail(`Nothing was deleted: ${error.message}`);
}
await db.end();

// ---- storage (outside the transaction; its plan was saved above) ------------
try {
    const files = await wipeStorage(storage, result.storageFolders, { commit });
    console.log(`\nStorage files ${commit ? 'removed' : 'to remove'}:`, files);
} catch (error) {
    fail(`Database ${commit ? 'wiped' : 'unchanged'}, storage step failed: ${error.message}\n` +
        (commit ? `Resume with: node scripts/wipe_users.mjs --confirm-project ${projectRef} --resume-storage ${planFile} --commit` : ''));
}

if (!commit) console.log('\nDry run only. Re-run with --commit --snapshot <dir> added to apply.');
