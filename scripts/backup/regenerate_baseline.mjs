/**
 * Regenerate supabase/migrations/00000000000000_baseline.sql from the live
 * schema, following the procedure the migrations README already documents.
 *
 *   node scripts/backup/regenerate_baseline.mjs           # write it
 *   node scripts/backup/regenerate_baseline.mjs --check   # diff only, exit 1 on drift
 *
 * The committed baseline was captured on 2026-07-10 and never refreshed, so it
 * is stale by every migration applied since. That matters twice over: it is
 * named in the README as the disaster-recovery reference, and it is the only
 * thing that would tell you the live schema had drifted from the migrations.
 *
 * --check makes it a drift detector: run it after applying a migration, and a
 * non-empty diff means the live schema is not what the migration files say.
 *
 * Requires DATABASE_URL in .env.local and pg_dump on PATH.
 */
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import fs from 'node:fs';

dotenv.config({ path: '.env.local', quiet: true });

const TARGET = 'supabase/migrations/00000000000000_baseline.sql';
const checkOnly = process.argv.includes('--check');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing from .env.local');
    process.exit(1);
}

const probe = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
if (probe.error) {
    console.error('pg_dump is not on PATH. See scripts/backup/snapshot.mjs for install hints.');
    process.exit(1);
}

const r = spawnSync(
    'pg_dump',
    [process.env.DATABASE_URL, '--schema-only', '--schema=public',
     '--no-owner', '--no-privileges', '--quote-all-identifiers'],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
);
if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
}

// pg_dump stamps its own version and the server version into a header comment,
// which would show up as a spurious diff every time the client is upgraded.
// Strip it so --check only reports real schema drift.
const normalise = (sql) => sql
    .split('\n')
    .filter(l => !/^-- Dumped (from|by)/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd() + '\n';

const next = normalise(r.stdout);
const prev = fs.existsSync(TARGET) ? normalise(fs.readFileSync(TARGET, 'utf8')) : '';

if (prev === next) {
    console.log(`${TARGET} already matches the live schema. No drift.`);
    process.exit(0);
}

const prevLines = prev ? prev.split('\n').length : 0;
const nextLines = next.split('\n').length;

if (checkOnly) {
    console.error(`DRIFT: ${TARGET} does not match the live schema (${prevLines} -> ${nextLines} lines).`);
    console.error('Run `npm run db:schema` and review the diff before committing.');
    process.exit(1);
}

fs.writeFileSync(TARGET, next, 'utf8');
console.log(`Wrote ${TARGET} (${prevLines} -> ${nextLines} lines).`);
console.log('Review the diff with `git diff -- ' + TARGET + '` before committing:');
console.log('it should contain every schema change applied since the file was last generated,');
console.log('and nothing you do not recognise.');
