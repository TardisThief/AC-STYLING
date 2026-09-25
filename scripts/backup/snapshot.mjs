/**
 * Take a tagged, on-demand snapshot of the live database from a dev machine.
 *
 *   node scripts/backup/snapshot.mjs --tag pre-migration-21
 *   node scripts/backup/snapshot.mjs --tag before-catalog-import --out D:/backups
 *
 * This is the concrete implementation of step 4 of the migration execution
 * policy in supabase/migrations/README.md ("capture the affected schema and
 * configuration for recovery"). Until now that step had no tooling behind it:
 * the only recovery metadata that ever existed was hand-written JSON for
 * migration 12, inside .git/, untracked and never pushed.
 *
 * Run it BEFORE applying a migration. It writes to ./backups/ by default,
 * which is gitignored -- dumps must never enter the repository, because a
 * customer row committed once stays in git history forever.
 *
 * Requires DATABASE_URL in .env.local and pg_dump on PATH.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config({ path: '.env.local', quiet: true });

// Same reason as the `umask 077` in lib.sh: a snapshot holds auth.users rows
// and customer data, so it should not be group- or world-readable. No-op on
// Windows, where the process umask is not honoured.
try { process.umask(0o077); } catch { /* not supported on this platform */ }

const arg = (name, fallback = null) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : fallback;
};

const tag = arg('tag');
if (!tag) {
    console.error('usage: node scripts/backup/snapshot.mjs --tag <label> [--out <dir>]');
    process.exit(1);
}
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(tag)) {
    console.error(`--tag "${tag}" must be a plain label (letters, digits, . _ -), it becomes a folder name.`);
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing from .env.local');
    process.exit(1);
}

const which = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
if (which.error) {
    console.error(
        'pg_dump is not on PATH.\n' +
        '  Windows: install the PostgreSQL client tools (https://www.postgresql.org/download/windows/)\n' +
        '           and add its bin directory (e.g. C:/Program Files/PostgreSQL/17/bin) to PATH.\n' +
        '  macOS:   brew install libpq && brew link --force libpq\n' +
        '  Ubuntu:  sudo apt install postgresql-client',
    );
    process.exit(1);
}
const clientMajor = Number(which.stdout.match(/(\d+)/)[1]);

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: [{ server_version: serverVersion }] } = await client.query('SHOW server_version');
const serverMajor = Number(String(serverVersion).split('.')[0]);
if (clientMajor < serverMajor) {
    await client.end();
    console.error(
        `pg_dump is major ${clientMajor} but the server is ${serverMajor}. ` +
        `An older client can produce a dump that restores incompletely — install postgresql-client-${serverMajor}.`,
    );
    process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '').replace(/-/g, '-').slice(0, 17) + 'Z';
const outRoot = arg('out', 'backups');
const dir = path.join(outRoot, `${tag}--${stamp}`);
fs.mkdirSync(dir, { recursive: true });

// `auth` is not optional: migration 15 added profiles.id -> auth.users(id),
// so a public-only dump cannot be restored on its own.
const common = ['--no-owner', '--no-privileges', '--quote-all-identifiers'];
const run = (args, label) => {
    process.stdout.write(`${label} ... `);
    const r = spawnSync('pg_dump', [process.env.DATABASE_URL, ...args], {
        encoding: 'buffer',
        maxBuffer: 1024 * 1024 * 1024,
    });
    if (r.status !== 0) {
        console.log('failed');
        return { ok: false, stderr: r.stderr?.toString() ?? '' };
    }
    console.log('ok');
    return { ok: true };
};

const dumpPath = path.join(dir, 'database.dump');
let authMode = 'full';
let res = run(['-Fc', ...common, '--schema=public', '--schema=auth', '--schema=storage', '-f', dumpPath],
    'dumping public + auth + storage');
if (!res.ok) {
    console.warn(`  ${res.stderr.trim().split('\n').slice(-1)[0]}`);
    console.warn('  retrying without the auth schema');
    authMode = 'fallback';
    res = run(['-Fc', ...common, '--schema=public', '--schema=storage', '-f', dumpPath],
        'dumping public + storage');
    if (!res.ok) {
        await client.end();
        console.error(res.stderr);
        process.exit(1);
    }
}

run([...common, '--schema-only', '--schema=public', '-f', path.join(dir, 'schema.sql')],
    'writing plain-text schema');

// count(*) per table rather than pg_stat_user_tables.n_live_tup, which is a
// statistics estimate that stays stale after deletes until autovacuum runs --
// it made the restore drill fail on a table the dump had correctly emptied.
// Same query as dump_database.sh, so both produce the same file format.
const { rows: counts } = await client.query(`
    SELECT c.relname AS relname,
           (xpath('/row/c/text()',
                  query_to_xml(format('SELECT count(*) AS c FROM public.%I', c.relname),
                               false, true, '')))[1]::text::bigint AS row_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
`);
fs.writeFileSync(
    path.join(dir, 'rowcounts.tsv'),
    counts.map(r => `${r.relname}\t${r.row_count}`).join('\n') + '\n',
    'utf8',
);
await client.end();

const bytes = fs.statSync(dumpPath).size;
const sha256 = createHash('sha256').update(fs.readFileSync(dumpPath)).digest('hex');
fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify({
    name: path.basename(dir),
    tag,
    taken_at: new Date().toISOString(),
    host: process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? 'unknown',
    database: { auth_mode: authMode, public_tables: counts.length, bytes, sha256 },
}, null, 2)}\n`, 'utf8');

// database.meta in the same key=value format dump_database.sh writes, because
// restore_drill.sh reads auth_mode and rowcounts from it. Without this file a
// snapshot taken here looked degraded to the drill through no fault of its own.
fs.writeFileSync(path.join(dir, 'database.meta'), [
    `dumped_at=${new Date().toISOString()}`,
    `auth_mode=${authMode}`,
    `schemas=${authMode === 'full' ? 'public,auth,storage' : 'public,storage'}`,
    `public_tables=${counts.length}`,
    'rowcounts=exact',
    `dump_bytes=${bytes}`,
    `dump_sha256=${sha256}`,
    `pg_dump_version=${which.stdout.trim().split('\n')[0]}`,
    '',
].join('\n'), 'utf8');

console.log(`\nSnapshot: ${dir}`);
console.log(`  ${(bytes / 1024 / 1024).toFixed(1)} MB, ${counts.length} public tables, auth=${authMode}`);
console.log(`  sha256 ${sha256}`);
if (authMode !== 'full') {
    console.log('\n  WARNING: the auth schema is missing from this snapshot.');
    console.log('  Restoring it will NOT recreate logins. Record this in the migration notes.');
}
console.log('\nNote: this snapshot is local only. hermes holds the off-site copies.');
