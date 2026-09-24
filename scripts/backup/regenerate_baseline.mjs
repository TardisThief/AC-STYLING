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

// Privileges and ownership are deliberately INCLUDED, unlike in snapshot.mjs.
// The README calls this file the source of truth for "tables, RLS, triggers,
// functions, grants", and the 2026-07-10 capture it describes does contain the
// GRANT/REVOKE and OWNER statements. This script originally passed
// --no-owner --no-privileges, so the first person to run it would have silently
// deleted 123 grant statements from the schema reference -- on a project whose
// hosting tier provides no backups of its own. A dump that quietly drops the
// permission model is worse than a stale one, because it still looks complete.
const r = spawnSync(
    'pg_dump',
    [process.env.DATABASE_URL, '--schema-only', '--schema=public',
     '--quote-all-identifiers'],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
);
if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
}

// Two things change on every run without the schema changing at all, and both
// would make --check cry drift forever:
//
//   1. pg_dump stamps its own version and the server version into a header
//      comment, so upgrading the client would look like a schema change.
//   2. pg_dump 17 wraps its output in `\restrict <token>` / `\unrestrict
//      <token>`, and the token is freshly random each run. The pair is kept --
//      dropping one and not the other would change how psql restores the file
//      -- but the token is pinned to a constant.
//   3. pg_dump on Windows returns CRLF while the committed file is LF, so
//      without stripping them every single line reads as changed and --check
//      reports the whole schema as drift. Every \r goes, not just the CRLF
//      pairs: `can_access_wardrobe_object` was created from a CRLF-authored
//      migration, so its stored body really does contain \r\n, and on Windows
//      that comes back out as \r\r\n. Replacing only pairs leaves one behind.
const normalise = (sql) => sql
    .replace(/\r/g, '')
    .split('\n')
    .filter(l => !/^-- Dumped (from|by)/.test(l))
    .map(l => l.replace(/^\\(restrict|unrestrict) \S+$/, '\\$1 baseline'))
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
