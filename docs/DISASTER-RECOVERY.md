# Disaster recovery

**Audience: whoever is recovering the platform, possibly at 2am, possibly not
the person who set this up.** Commands are exact and in order. Read the scenario
headings first and go straight to the one you are in.

## Before anything else

1. **Stop making it worse.** If a migration or script is mid-run, let it finish
   or kill it — do not run a second one "to fix it".
2. **Do not delete anything**, including rows you believe are corrupt. A bad row
   is evidence; a deleted row is a second problem.
3. **Take a snapshot of the broken state** before you restore over it:
   `npm run db:snapshot -- --tag incident-<date>`. You will want to compare.

## What exists to recover from

| Artifact | Where | Covers | Frequency |
|---|---|---|---|
| Database snapshots | hermes `$AC_BACKUP_ROOT/db/`, and `acbackup:db` on R2 | `public` + `auth` + `storage` schemas | nightly, 7/4/12 GFS |
| Storage mirror | hermes `$AC_BACKUP_ROOT/storage-mirror/`, and `acbackup:storage` | every bucket's file bytes | nightly, incremental |
| Tagged snapshots | same, names containing `--` | whatever the moment needed | on demand, never pruned |
| `content/catalog/catalog.json` | this repo, in git | masterclasses + chapters only | per content commit |
| `supabase/migrations/` | this repo, in git | schema, RLS, functions | per migration |

**Supabase itself holds nothing.** The project is on the free tier: no daily
backup, no dashboard restore, no point-in-time recovery. If it is not in the
table above, it is not recoverable.

## Getting a snapshot in hand

On hermes, the newest local snapshot:

```bash
. ~/.ac-styling/.env.backup
SNAP=$(ls -d "$AC_BACKUP_ROOT"/db/*/ | tail -1); echo "$SNAP"
bash ~/ac-styling/scripts/backup/verify.sh "$SNAP"
```

From anywhere else, with the crypt password and salt from the password manager
(configure the `acbackup` remote as described in
[`HERMES-BACKUP-SETUP.md`](HERMES-BACKUP-SETUP.md) § 4):

```bash
rclone ls acbackup:db | sort            # pick one
rclone copy acbackup:db/<name> ./restore/<name> -P
```

For the storage mirror, the equivalent is offline and needs nothing but the
disk:

```bash
bash ~/ac-styling/scripts/backup/verify_storage.sh "$AC_BACKUP_ROOT/storage-mirror"
```

It re-hashes every mirrored object against the eTag recorded in `index.tsv`, so
it catches rot that happened *since* the last sync. Run it before relying on the
mirror to rebuild a bucket.

Always run `verify.sh` before trusting a snapshot. It catches a truncated dump,
a checksum mismatch, and a dump that is missing the `auth` schema — all of which
open cleanly and fail later.

---

## Scenario 1 — One table is damaged

The common case: a migration or a script wrote the wrong thing to one table, and
everything else is fine. **Do not restore the whole database for this.** You
would roll back every unrelated change made since the backup.

```bash
# 1. Restore the table into a scratch database, NOT production
docker run -d --name rescue -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:17
RESCUE="postgresql://postgres:pw@127.0.0.1:55432/postgres"
pg_restore -d "$RESCUE" --no-owner --no-privileges -t <table> "$SNAP/database.dump"

# 2. Look at it before you move it
psql "$RESCUE" -c 'SELECT count(*) FROM public.<table>;'

# 3. Move just what you need into production, as data
pg_dump "$RESCUE" --data-only -t public.<table> -f /tmp/<table>.sql
```

Then open `/tmp/<table>.sql`, read it, and apply it to production deliberately —
inside a transaction, with the existing rows handled explicitly. Do not pipe a
dump straight into production: the file may contain rows that already exist, and
a blind load fails halfway and leaves the table in a third state.

Follow the migration procedure in
[`supabase/migrations/README.md`](../supabase/migrations/README.md): dry-run in a
rolled-back transaction, then commit, then verify on a fresh connection.

---

## Scenario 2 — The whole database is wrong, project still exists

```bash
# Confirm the snapshot is sound FIRST
bash scripts/backup/verify.sh "$SNAP"
bash scripts/backup/restore_drill.sh "$SNAP"     # proves it restores at all

# Snapshot the broken state before overwriting it
npm run db:snapshot -- --tag incident-$(date +%Y%m%d)
```

Restoring over a live Supabase project is not a clean operation: the `auth` and
`storage` schemas are owned by roles you do not control, and objects that already
exist will collide.

```bash
# 1. Clear Supabase's default ALL grants so restored objects start owner-only
#    (see "Privileges" below: skipping this reopens every locked column).
psql "$DATABASE_URL" -f scripts/backup/pre_restore_privileges.sql

# 2. Restore public WITH privileges. Never --no-privileges: the GRANT/REVOKEs
#    are the app's column-level security model.
pg_restore -d "$DATABASE_URL" \
  --no-owner \
  --clean --if-exists \
  --schema=public \
  "$SNAP/database.dump"

# 3. Snapshot taken before 2026-09-26? It carries no privileges: apply the
#    committed baseline's. A statement naming an object the snapshot predates
#    fails on its own; that is expected.
tr -d '\r' < supabase/migrations/00000000000000_baseline.sql \
  | grep -E '^(GRANT|REVOKE|ALTER DEFAULT PRIVILEGES) ' | psql "$DATABASE_URL"
```

Restore `public` only, as above. The `auth` and `storage` schemas in a live
project are still intact in this scenario — restoring over them risks breaking
logins and bucket metadata to fix a `public`-schema problem. Only go wider if
`auth` is genuinely damaged, and expect to fight role ownership when you do.

Afterwards:

```bash
npm run db:schema:check      # live schema matches the committed baseline?
node scripts/verify_authorization.mjs
node scripts/verify_wardrobe_policy.ts
npm run test:run
```

---

## Scenario 3 — The Supabase project is gone

Free-tier projects can be paused for inactivity and deleted. This is the
scenario the whole system exists for.

1. **Create a new Supabase project.** Note the new project ref; every URL and
   key changes.
2. **Restore the schema and data:**

```bash
NEW="postgresql://postgres.<newref>:<pw>@<region>.pooler.supabase.com:5432/postgres"

# 1. auth users and identities FIRST. profiles.id references auth.users(id)
#    (migration 15): restored the other way round, the foreign key cannot be
#    created over profiles whose users do not exist yet, and pg_restore carries
#    on without it. Supabase manages the rest of the auth schema, so only these
#    two tables' data. The new project has no trigger yet, so no profiles are
#    created behind your back.
pg_restore -d "$NEW" --no-owner --data-only -n auth -t users -t identities "$SNAP/database.dump"

# 2. Clear Supabase's default ALL grants so restored objects start owner-only.
psql "$NEW" -f scripts/backup/pre_restore_privileges.sql

# 3. public schema and data, WITH privileges (never --no-privileges), skipping
#    the archive's CREATE SCHEMA public: the project already has one.
pg_restore -l "$SNAP/database.dump" | grep -vE '^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public ' > /tmp/toc.list
pg_restore -d "$NEW" --no-owner --schema=public -L /tmp/toc.list "$SNAP/database.dump"

# 4. Snapshot taken before 2026-09-26? It carries no privileges: apply the
#    committed baseline's (Scenario 2, step 3).

# 5. What lives outside public but is ours: the trigger that creates a profile
#    for each new auth user, our storage policies, and the bucket rows.
pg_restore -l "$SNAP/database.dump" \
  | grep -E 'TRIGGER auth users on_auth_user_created| POLICY storage objects | TABLE DATA storage buckets ' > /tmp/ours.list
pg_restore -d "$NEW" --no-owner -L /tmp/ours.list "$SNAP/database.dump"
```

Then check it the same way as Scenario 2 (`db:schema:check`,
`verify_authorization.mjs`), and confirm `SELECT count(*) FROM pg_policies
WHERE schemaname = 'storage'` is 9 and `studio-wardrobe` is private.

3. **Recreate what lives outside the database:** auth providers and redirect
   URLs, and any edge configuration. Buckets and their policies came back in
   step 5 above; check that `studio-wardrobe` is **private**. The bucket
   policy function `public.can_access_wardrobe_object` comes back with the
   `public` schema.
4. **Re-upload the storage objects** (Scenario 4).
5. **Update every environment**: Vercel environment variables, `.env.local`, and
   `~/.ac-styling/.env.backup` on hermes. See
   `memory/supabase-oauth-multienv-config` for the OAuth redirect allow-list
   alignment this needs.
6. **Rotate the old service-role key** if the old project is still reachable.

Expect password resets: user rows carry their hashes, but anything the platform
held outside the database does not come back.

---

### Privileges — read this before any restore

Until 2026-09-26 every backup (nightly and `db:snapshot`) was taken with
`pg_dump --no-privileges`, and every restore command here passed it too. The
GRANT/REVOKEs are this app's column-level security model: chapter video ids,
paid Lab questions and downloads, profile role and access flags, and which
RPCs browser roles may call. None of it was in any backup.

Dumping them is not enough. Supabase gives every new object in `public` ALL
for `anon`, `authenticated` and `service_role` through default privileges, and
`pg_dump` writes ACLs as if objects start owner-only: it never revokes a grant
it assumes is not there. A straight restore into a Supabase project therefore
leaves, for example, table-level SELECT on `chapters` for `anon`, and
`video_id` is public again. `scripts/backup/pre_restore_privileges.sql` clears
those defaults first; the dump then reproduces production exactly and puts the
defaults back afterwards.

Measured with `restore_drill.sh`, which since that date sets Supabase-like
default privileges in its container and checks five privileges after the
restore (three locked, two open):

| Snapshot | Pre-restore step | Result |
|---|---|---|
| taken with privileges | yes | all pass |
| taken with privileges | no | anon reads `video_id`, members set their own `role`, anon calls `check_access` |
| taken before 2026-09-26 | yes, plus baseline privileges | all pass (2 baseline statements named a later object) |
| taken before 2026-09-26 | yes, without baseline privileges | the site cannot read its own catalogue |

Scenario 3's ordering (auth first) and step 5 were checked against a real
snapshot's table of contents; the full sequence has not yet been run against
a new Supabase project.

---

## Scenario 4 — Storage objects are lost

The mirror is a plain directory tree of `<bucket>/<path>`, so re-uploading is
straightforward. Files deleted upstream are in
`storage-mirror/quarantined/<date>/` rather than gone — and so are files that
were found damaged locally and re-fetched, so that directory holds both "deleted
upstream" and "rotted here". The dated subdirectory and the run log tell them
apart.

**Check the mirror before you upload from it:**

```bash
bash scripts/backup/verify_storage.sh "$AC_BACKUP_ROOT/storage-mirror"
```

Re-uploading a corrupted image over a good one would turn a recoverable
situation into a permanent loss.

```bash
. ~/.ac-styling/.env.backup
cd "$AC_BACKUP_ROOT/storage-mirror/files"

for f in $(find studio-wardrobe -type f); do
  path="${f#studio-wardrobe/}"
  curl -fsS -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$f" \
    "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/studio-wardrobe/$path" \
    || echo "FAILED: $path"
done
```

Upload into a bucket that already exists with the right visibility. Then confirm
the app can actually render them — `studio-wardrobe` is served through signed
URLs (`lib/wardrobe-images.ts`), so a successful upload is not proof that the
path convention in `lib/wardrobe-paths.ts` was preserved. Open a wardrobe in the
Studio and look.

---

## Scenario 5 — Content catalog only

If masterclasses or chapters are wrong but nothing else is, the catalog has its
own round-trip and it is gentler than a restore:

```bash
node scripts/export_catalog.mjs --out /tmp/catalog-now.json   # capture current
node scripts/import_catalog.mjs                               # dry run from git
node scripts/import_catalog.mjs --apply
```

Two traps, both previously hit and recorded in
[`supabase/migrations/README.md`](../supabase/migrations/README.md): the importer
**never deletes**, so removing an entry from the file does not remove the row;
and it matches masterclasses by **title**, so a renamed title inserts a duplicate
instead of renaming. Renames need a migration — migration 18 exists for exactly
this.

---

## Drill record

A backup nobody has restored is a guess. `docs/ASSESSMENT-2026-09-19.md` recorded
that restoration had never been verified; this table is what makes that false.
Run `restore_drill.sh` quarterly and after any change to the backup scripts, and
add a row. Run `verify_storage.sh` on the same schedule — it is offline, takes
about a second, and answers a question the drill does not: whether the mirrored
files are still the files that were mirrored.

| Date | Snapshot | Result | Run by | Notes |
|---|---|---|---|---|
| 2026-09-25 | `2026-09-25T001744Z` | **PASSED** (10/10) | hermes | First real drill. Restored into a disposable postgres:17 container; container removed afterwards. Exact-count comparison, 0 tables outside tolerance. `profiles → auth.users` FK intact, `check_access()` present, RLS on all 28 tables, `auth.users` restored with 58 rows, single-table `pg_restore -t purchases` worked. Snapshot: `auth_mode=full`, 28 public tables, 435,911 bytes, sha256 `049d722a…33678`; storage mirror 74 objects / 58.4 MB, 0 quarantined. Script revision `7225858`. |
| 2026-09-26 | `privileges-check--2026-09-26T145009Z` and `pre-migration-31--2026-09-26T092643Z` | **PASSED** (both) | owner's workstation (Docker Desktop) | First drill of privileges, after finding that no backup contained any (see "Privileges" above). The drill now sets Supabase-like default privileges, runs `pre_restore_privileges.sql`, restores WITH privileges (skipping the archive's `CREATE SCHEMA public`) and checks five privileges. New-style snapshot: all checks pass. Pre-2026-09-26 snapshot with `DRILL_LEGACY_PRIVILEGES=1` (baseline privileges re-applied): all pass, 2 baseline statements skipped as naming migration 31's function. The same old snapshot without that step fails 3 checks (catalogue unreadable), and the new one without the pre-restore step failed all three lock checks. Also found: the dump names `supabase_admin` and `dashboard_user`, which the drill now creates. |

**What this drill establishes:** the nightly backup is restorable end to end,
including the login tables, and a single damaged table can be recovered on its
own without rolling anything else back. `docs/ASSESSMENT-2026-09-19.md:24` said
backup restoration had never been verified. As of this row, it has.

**What it does not establish:** the drill restores into an empty container, not
over a live Supabase project. Scenario 2 and Scenario 3 above still involve
steps no drill exercises — role ownership on the `auth` and `storage` schemas,
recreating buckets and auth providers, and re-pointing every environment. Read
them before you need them, not during.
