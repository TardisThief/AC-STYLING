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
pg_restore -d "$DATABASE_URL" \
  --no-owner --no-privileges \
  --clean --if-exists \
  --schema=public \
  "$SNAP/database.dump"
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

# public schema and data
pg_restore -d "$NEW" --no-owner --no-privileges --schema=public "$SNAP/database.dump"

# auth: users and identities only. Supabase manages the rest of this schema,
# so restoring it wholesale fights the new project's own objects.
pg_restore -d "$NEW" --no-owner --no-privileges --data-only \
  -t 'auth.users' -t 'auth.identities' "$SNAP/database.dump"
```

3. **Recreate what lives outside the database:** storage buckets (names and
   public/private flags — `studio-wardrobe` is **private**), auth providers and
   redirect URLs, and any edge configuration. The bucket policy function
   `public.can_access_wardrobe_object` comes back with the `public` schema.
4. **Re-upload the storage objects** (Scenario 4).
5. **Update every environment**: Vercel environment variables, `.env.local`, and
   `~/.ac-styling/.env.backup` on hermes. See
   `memory/supabase-oauth-multienv-config` for the OAuth redirect allow-list
   alignment this needs.
6. **Rotate the old service-role key** if the old project is still reachable.

Expect password resets: user rows carry their hashes, but anything the platform
held outside the database does not come back.

---

## Scenario 4 — Storage objects are lost

The mirror is a plain directory tree of `<bucket>/<path>`, so re-uploading is
straightforward. Files deleted upstream are in
`storage-mirror/quarantined/<date>/` rather than gone.

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
add a row.

| Date | Snapshot | Result | Run by | Notes |
|---|---|---|---|---|
| _pending_ | — | — | — | First drill runs during hermes setup. |
