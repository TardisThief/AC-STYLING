# hermes backup host — setup

**Audience: the Claude Code agent running on the hermes machine.** This document
assumes no knowledge of the AC Styling codebase. Everything you need is here.

---

## Kickstart prompt

*The owner pastes this into Claude Code on hermes. It is repeated here so the
document is self-contained.*

```
You are running on `hermes`, an always-on Ubuntu server with an external SSD.
I am making this machine the backup host for a production web platform called
AC Styling, whose database is on Supabase's free tier and therefore has no
backups at all today. Your job is to set up and prove a nightly backup.

The instructions live in the repository you are about to clone, but the clone
needs a deploy key I have to add for you first. So, in this order:

1. Generate an SSH key and show me the PUBLIC half:
     ssh-keygen -t ed25519 -C "hermes backup runner" -f ~/.ssh/id_ed25519_acstyling -N ""
     cat ~/.ssh/id_ed25519_acstyling.pub

2. WAIT for me to confirm I have added it to GitHub as a read-only deploy key.
   The clone fails until I do, and a failure here means nothing is wrong.

3. Then clone just the backup scripts and docs:
     cat >> ~/.ssh/config <<'EOF'
     Host github.com-acstyling
       HostName github.com
       User git
       IdentityFile ~/.ssh/id_ed25519_acstyling
       IdentitiesOnly yes
     EOF
     git clone --filter=blob:none --no-checkout \
       git@github.com-acstyling:TardisThief/AC-STYLING.git ~/ac-styling
     cd ~/ac-styling
     git sparse-checkout init --cone
     git sparse-checkout set scripts/backup docs
     git checkout main

4. Read docs/HERMES-BACKUP-SETUP.md and follow it from section 1 onwards
   (you will have already done section 2). It lists the packages to install,
   the credentials file to create, the rclone remotes, the cron entry, and the
   verification you must run.

5. Ask me for the credentials when the document tells you to. Do not guess them
   and do not invent placeholder values — a backup configured against the wrong
   database looks exactly like one that is working.

Hard constraints:
- NEVER write to, alter, or delete anything in the production database or the
  Supabase storage buckets. This machine reads only. The credentials you are
  given are powerful enough to destroy the business; treat every command that
  is not a SELECT or a download as out of bounds.
- Do not push to the git repository. The deploy key is read-only by design.
- Do not print secrets into your transcript or into any log file.

When you are done, report back: the first backup's manifest.json (it must say
status ok and auth_mode full), the output of the verify script, and the output
of the restore drill. If any of the three is not clean, tell me what failed
rather than working around it — an incomplete backup that looks fine is the
outcome this whole exercise exists to prevent.
```

---

## 1. Packages

```bash
sudo apt update
sudo apt install -y postgresql-client curl git coreutils
```

**Do not install rclone from apt.** Ubuntu 26.04 ships "rclone v1.60.1-DEV",
which sends an `X-Amz-Checksum-Crc64nvme` header that R2 rejects with
`501 NotImplemented` on every upload. The object lands but the upload reports
failure, so every sync fails while the data looks like it arrived — the worst
of both. Install rclone's own build instead (their official installer; v1.75.1
is verified working here):

```bash
curl -fsSL https://rclone.org/install.sh | sudo bash
rclone version    # must NOT say 1.60.1-DEV
```

`sudo` needs a real terminal — run these yourself rather than through an
agent's non-interactive shell, which cannot answer a password prompt.

Then check the Postgres client major version:

```bash
pg_dump --version
```

It must be **greater than or equal to** the Supabase server's major version. The
scripts check this and refuse to run if it is lower, because an older client can
produce a dump that restores incompletely — which you would only discover during
a real recovery. If yours is too old, add the PGDG apt repository
(<https://www.postgresql.org/download/linux/ubuntu/>) and install the matching
`postgresql-client-NN`. A *newer* client is fine: Ubuntu 26.04's
`postgresql-client` is v18 and the Supabase server is 17, which is the
supported direction.

Docker is needed only for the restore drill:

```bash
sudo apt install -y docker.io && sudo usermod -aG docker "$USER"   # log out and back in
```

---

## 2. SSH key and repository checkout

*If you followed the kickstart prompt you have already done this section — skip
to section 3. It is repeated here so the document stands on its own.*

```bash
ssh-keygen -t ed25519 -C "hermes backup runner" -f ~/.ssh/id_ed25519_acstyling -N ""
cat ~/.ssh/id_ed25519_acstyling.pub
```

Give that public key to the owner to add as a **read-only** deploy key, then:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com-acstyling
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_acstyling
  IdentitiesOnly yes
EOF

git clone --filter=blob:none --no-checkout git@github.com-acstyling:TardisThief/AC-STYLING.git ~/ac-styling
cd ~/ac-styling
git sparse-checkout init --cone
git sparse-checkout set scripts/backup docs
git checkout main
```

A sparse, blobless checkout keeps this to the backup scripts and docs rather
than the whole Next.js application. There is no `npm install` — every script
that runs on this machine is bash, `psql` and `curl`.

---

## 3. Credentials

Ask the owner for these. They arrive from the owner's `.env.local` and from the
Cloudflare and healthchecks.io setup described in `docs/BACKUP-OWNER-SETUP.md`.

```bash
mkdir -p ~/.ac-styling && chmod 700 ~/.ac-styling
umask 077
cat > ~/.ac-styling/.env.backup <<'EOF'
# Supabase — READ ONLY USE. Never write with these.
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service role key>"

# Where backups are written on this machine (the external SSD)
AC_BACKUP_ROOT="/mnt/backup/ac-styling"

# Off-site, encrypted. Configured in step 4.
RCLONE_REMOTE="acbackup:"

# Dead-man's switch
HEALTHCHECK_URL="https://hc-ping.com/<uuid>"
EOF
chmod 600 ~/.ac-styling/.env.backup
```

`DATABASE_URL` must be the **pooler** host on **port 5432** (session mode), as
shown above. Supabase free-tier direct connections are IPv6-only, and the
transaction-mode pooler on port 6543 cannot carry a dump. The owner's existing
connection string is already the right one — use it as given.

Set `AC_BACKUP_ROOT` to a path on the external SSD and make sure it is mounted
at boot (`/etc/fstab`), not just mounted by hand. A backup written to an
unmounted mountpoint silently fills the root filesystem instead of the SSD.

```bash
mkdir -p /mnt/backup/ac-styling
```

---

## 4. rclone: R2 plus encryption

Two remotes. The first talks to Cloudflare R2; the second wraps it in
encryption, so nothing readable ever leaves this machine.

```bash
rclone config create r2raw s3 \
  provider=Cloudflare \
  access_key_id=<R2 ACCESS KEY ID> \
  secret_access_key=<R2 SECRET> \
  endpoint=<https://ACCOUNT-ID.r2.cloudflarestorage.com> \
  no_check_bucket=true

rclone config create acbackup crypt \
  remote=r2raw:ac-syling-backups \
  password="$(rclone obscure '<RCLONE_CRYPT_PASSWORD>')" \
  password2="$(rclone obscure '<RCLONE_CRYPT_SALT>')"
```

R2 has no object ACLs (buckets are private by default), so `acl=` is omitted.
`no_check_bucket=true` is required because a token scoped to one bucket cannot
run the bucket-existence check rclone otherwise does first.

Use `rclone config` interactively instead if you prefer — it keeps the passwords
out of your shell history, which the commands above do not. Either way, clear
the history afterwards.

Check it:

```bash
rclone lsd r2raw:ac-syling-backups     # should succeed and be empty
echo hello | rclone rcat acbackup:smoke-test
rclone cat acbackup:smoke-test          # must print: hello
rclone delete acbackup:smoke-test
```

If `rclone cat` prints anything other than `hello`, the password or salt is
wrong. Stop and resolve it — every backup written with the wrong key is
unrecoverable by the owner.

---

## 5. First run

```bash
cd ~/ac-styling
bash scripts/backup/backup.sh --no-pull
```

Expect: a database dump, a full storage download (the first run fetches
everything), a manifest, and a push to R2. It ends by pinging the healthcheck.

Then verify, without trusting the exit code:

```bash
SNAP=$(ls -d "$AC_BACKUP_ROOT"/db/*/ | tail -1)
bash scripts/backup/verify.sh "$SNAP"
cat "$SNAP/manifest.json"
```

`manifest.json` must show `"status": "ok"` and `"auth_mode": "full"`, and its
storage block should show `verified` equal to the object count with `repaired`
at 0. A non-zero `repaired` is not a failed backup — the file was re-fetched
and checked — but it means a file on this disk had rotted since it was
written, so look at the drive. If
`auth_mode` is `fallback` or `missing`, the dump does not contain the login
tables, and a restore would not recreate any user's ability to sign in. Report
that to the owner rather than accepting it — the `pg_dump.log` in the snapshot
directory says why it failed.

---

## 6. The restore drill — do not skip this

Everything up to here proves that files were written. This proves they are
worth having. A prior assessment of this platform recorded that backup
restoration had never been verified; this is the step that changes that.

```bash
bash scripts/backup/restore_drill.sh "$SNAP"
```

It starts a disposable Postgres container, restores the whole snapshot into it,
checks that the tables, the `profiles → auth.users` foreign key, the
`check_access()` function and row-level security all came back, then restores a
single table on its own to prove the realistic recovery path. It removes the
container afterwards. It never touches production.

It must print `RESTORE DRILL PASSED`. If it does not, the backup is not a
backup yet.

---

## 7. Schedule it

```bash
crontab -e
```

```cron
# AC Styling nightly backup — 03:17 local. Logs rotate by day; failures also
# page via the healthcheck configured in ~/.ac-styling/.env.backup
17 3 * * * umask 077; mountpoint -q /mnt/backup && cd "$HOME/ac-styling" && /usr/bin/flock -n /tmp/ac-backup.lock bash scripts/backup/backup.sh >> "$HOME/.ac-styling/backup-$(date +\%Y\%m\%d).log" 2>&1
```

`flock` stops a slow run from overlapping the next one. The odd minute avoids
the top-of-hour crowd on shared infrastructure.

`mountpoint -q /mnt/backup` is the important one. The SSD is mounted with
`nofail`, so if it is missing the machine boots anyway and `$AC_BACKUP_ROOT`
becomes an ordinary directory on the root disk — backups would quietly fill it
and none of them would be on the SSD. With the guard the run simply does not
happen, no healthcheck ping is sent, and the missed ping becomes the alert.
`umask 077` repeats what lib.sh sets, so the log file cron creates by
redirection is owner-only too.

Prune old logs:

```cron
0 4 * * 0 find "$HOME/.ac-styling" -name 'backup-*.log' -mtime +30 -delete
```

Confirm the schedule took effect the next morning: healthchecks.io should show a
recent ping, and a new dated directory should exist under `$AC_BACKUP_ROOT/db/`.

---

## What the scripts do

| Script | Role |
|---|---|
| `backup.sh` | The cron entrypoint. Pulls, dumps, mirrors, prunes, uploads, pings. |
| `dump_database.sh` | `pg_dump -Fc` of `public` + `auth` + `storage`, plus a plain-text schema and row counts. |
| `dump_storage.sh` | Incremental mirror of every storage bucket, by eTag and size. |
| `verify.sh` | Checks a snapshot is complete and loadable, without restoring it. |
| `verify_storage.sh` | Checks the storage mirror on disk against its own index. Entirely offline — no network, no database. Run it when you suspect the disk. |
| `restore_drill.sh` | Restores into a disposable container and checks the result. |

Three behaviours worth knowing before you debug something:

- **Every mirrored file is checked against its bytes, not just its metadata.**
  A file is only accepted — on download and on skip — when its size matches the
  object's metadata and, where the eTag is a plain MD5, its content hashes to
  it. This exists because the earlier version compared upstream metadata to the
  previous index and never looked at the local file, so a corrupted or
  truncated image stayed broken for ever while every run reported success.
  `verified` and `repaired` in the manifest are how you see it working.

- **Vanished storage objects are quarantined, not deleted.** If files disappear
  upstream, the mirror moves its copies to `storage-mirror/quarantined/<date>/`
  rather than deleting them. An accidental or malicious mass-delete in
  production must not propagate into the backup on the next run — that is
  exactly the event the backup exists for. Quarantined files are never pruned
  automatically; the owner decides.
- **Tagged snapshots are never pruned.** Retention keeps 7 daily, 4 weekly and
  12 monthly snapshots, but any directory whose name contains `--` (for example
  `pre-migration-21--...`) is kept indefinitely, because someone deliberately
  marked that moment.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `pg_dump N is older than the server` | Install the matching `postgresql-client-NN` from the PGDG repository. Do not work around this. |
| `auth_mode=fallback` in the manifest | The `postgres` role could not read the `auth` schema. Check `pg_dump.log` in the snapshot. Report to the owner — the backup is incomplete without it. |
| Connection times out | `DATABASE_URL` must be the pooler host on port 5432. Free-tier direct connections are IPv6-only. |
| Storage downloads all fail with 401/403 | `SUPABASE_SERVICE_ROLE_KEY` is wrong or has been rotated. |
| `rclone cat` returns garbage | Wrong crypt password or salt. Everything already uploaded under the wrong key is unreadable; fix it, then delete and re-upload. |
| healthchecks.io alerts but nothing looks wrong | A *degraded* run (missing auth schema, or storage objects that failed to download) deliberately reports as a failure. Read the newest log. |
| Backups stop after a reboot | The SSD is not mounted at boot. Add it to `/etc/fstab` with `nofail`, and keep the `mountpoint -q` guard in the cron line. |
| `download failed verification` | The body did not match the object's size or MD5. curl exiting 0 is not proof of a complete download. The file is rejected rather than saved, the index does not advance, and the next run retries it. Persistent failures on one object mean the upstream object itself changed mid-run, or the network is mangling it. |
| `local copy damaged, re-downloading` | A mirrored file no longer matches its eTag — bit rot, a failing disk, or an interrupted copy. The original is kept in `quarantined/<date>/` as evidence. One is worth noting; a pattern means replace the drive. |
| Every rclone upload fails with `501 NotImplemented` | The apt build of rclone (v1.60.1-DEV) sends a checksum header R2 rejects. Reinstall from <https://rclone.org/install.sh> — see section 1. The objects may appear in the bucket even though the sync reported failure. |
| `pg_restore: ERROR: schema "public" already exists` | An old checkout of `restore_drill.sh`. The dump carries `CREATE SCHEMA public` because it is taken with `--schema=public`, and a stock postgres image already has one. Fixed by dropping the stock schema in the throwaway container first — `git pull`. |
| `refusing to sync` or `--max-delete` tripped | A safety guard, not a bug. `rclone sync` mirrors deletions, so an unmounted SSD would otherwise erase the off-site copy. Find out why the local tree shrank before overriding anything. |

## Boundaries

This machine reads production. It never writes to it. If a task seems to require
writing to the Supabase database or storage — including "cleaning up" orphaned
files — that work belongs on a developer machine with the owner's knowledge, not
here. The credentials on this host are sufficient to destroy the business, and
the only thing standing between an accident and permanent loss is the backup
this machine is producing.
