# Backup setup — owner instructions

**Audience: the project owner. No coding required.** Everything here is account
signup, key generation and copy-paste. It takes about 30 minutes.

You are doing this because the Supabase project is on the **free tier**, which
includes no backups of any kind — no daily snapshot, no dashboard restore, no
point-in-time recovery. Right now, if the project were deleted or a migration
went wrong, the only things that survive are a schema file from July and a JSON
export of two tables. Every account, purchase, client wardrobe and uploaded
photograph would be gone.

At the end of this you will have a nightly encrypted backup of the whole
database and every storage bucket, held both on your own hardware and off-site,
and a rehearsed restore proving it works.

---

## What you are building

```
hermes (your Ubuntu box)  ──nightly──►  local SSD copy (plaintext)
                          ──nightly──►  Cloudflare R2 (encrypted)
                          ──on success──►  healthchecks.io ──no ping──► email alert
```

**A note on encryption, because it changed during planning.** The original plan
encrypted backups with a key hermes did not hold. That turned out to be security
theatre: hermes must hold the Supabase service-role key in order to read the data
at all, so anything hermes can back up, hermes can already read. Encrypting the
local copy would have protected nothing while making restores harder. So: **what
leaves the building is encrypted, what stays on the SSD is not.** If the SSD
itself worries you, turn on full-disk encryption for it — that is the right tool
for that job.

---

## Step 1 — Cloudflare R2 (about 10 minutes)

R2 is object storage. It is chosen over the alternatives because it charges
nothing for *downloads*, which matters more than it sounds: a backup you are
reluctant to download is a backup you will never test.

1. Go to <https://dash.cloudflare.com> and sign up (free; a card is required for
   R2 even on the free allowance).
2. In the sidebar choose **R2 Object Storage** → **Create bucket**.
   - Name: `ac-styling-backups`
   - Location: **Automatic**
   - Leave everything else at its default. **Do not** enable public access.
3. Still in R2, click **Manage R2 API Tokens** → **Create API token**.
   - Permission: **Object Read & Write**
   - Scope: **Apply to specific buckets only** → `ac-styling-backups`
   - TTL: **Forever**
4. Cloudflare now shows three values **once**. Copy all three somewhere safe
   immediately — the secret is never shown again:
   - Access Key ID
   - Secret Access Key
   - The **S3 endpoint**, which looks like
     `https://<account-id>.r2.cloudflarestorage.com`

**Done looks like:** an empty bucket named `ac-styling-backups`, and three values
written down.

---

## Step 2 — The encryption password (about 5 minutes)

This is the most important step on the page, and the easiest to get wrong.

rclone encrypts the off-site copies using a password and a salt. **If you lose
both, every off-site backup is permanently unreadable — there is no recovery, no
support ticket, no reset.** hermes keeps a copy so it can run unattended, but the
whole point is to be able to restore when hermes is *gone*.

1. Generate two long random strings. Any password manager's generator will do —
   use 40+ characters each. Label them:
   - `RCLONE_CRYPT_PASSWORD`
   - `RCLONE_CRYPT_SALT`
2. Store both **in your password manager**, as a single entry named
   "AC Styling backup encryption".
3. Store both **a second time somewhere that does not depend on your password
   manager** — printed and filed, or a sealed note somewhere safe. If your
   password manager and hermes fail together, these two strings are all that
   stand between you and total loss.

**Done looks like:** two long strings, saved in two independent places.

> You verify these actually work in Step 5. Do not skip that — a password you
> saved but never tested is not a backup plan.

---

## Step 3 — Let hermes read this repository (about 5 minutes)

hermes runs the backup scripts from this repo and pulls before each run, so fixes
and schema changes reach it automatically.

1. On hermes, its agent generates an SSH key and gives you the **public** half
   (one line starting `ssh-ed25519`).
2. In GitHub, open this repository → **Settings** → **Deploy keys** → **Add
   deploy key**.
   - Title: `hermes backup runner`
   - Key: paste the line
   - **Leave "Allow write access" UNCHECKED.** The backup host should never be
     able to push to the repository.

**Done looks like:** one read-only deploy key listed, titled `hermes backup runner`.

---

## Step 4 — The failure alarm (about 5 minutes)

A backup that quietly stops running is worse than no backup, because you believe
you are covered. This is a dead-man's switch: hermes pings it after every
successful run, and if a ping does not arrive, you get an email.

1. Sign up at <https://healthchecks.io> (the free tier is enough).
2. **Add Check**:
   - Name: `AC Styling nightly backup`
   - Period: **1 day**
   - Grace time: **2 hours**
3. Copy the **ping URL** (`https://hc-ping.com/<uuid>`).
4. Confirm your email address under **Notification methods**.

**Done looks like:** a check showing "never pinged", and a ping URL copied.

---

## Step 5 — Hand over to hermes

Give the Claude Code instance on hermes the kickstart prompt at the top of
[`HERMES-BACKUP-SETUP.md`](HERMES-BACKUP-SETUP.md), then supply these values when
it asks. **Send them over something private** — not email, not a chat log you
would not want retained.

| What | Where it comes from |
|---|---|
| `DATABASE_URL` | your `.env.local` — already the correct pooler connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | your `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | your `.env.local` |
| R2 Access Key ID / Secret / endpoint | Step 1 |
| `RCLONE_CRYPT_PASSWORD` / `RCLONE_CRYPT_SALT` | Step 2 |
| Healthcheck ping URL | Step 4 |

**Then verify the encryption yourself, from a machine that is not hermes.** This
is what proves Step 2 worked. After hermes reports its first successful backup,
install rclone on your laptop, configure the same crypt remote using the password
and salt from your password manager, and run:

```
rclone ls acbackup:db
```

If you see filenames, your password works and you can recover without hermes. If
you see an error, fix it now — while hermes is still alive and the data is still
reproducible.

---

## What now lives where

After setup, production credentials exist in three places: your `.env.local`,
Vercel's environment variables, and `~/.ac-styling/.env.backup` on hermes.

That last one is new, and it is a real consequence worth accepting knowingly:
hermes can read your entire database and every client photograph. If that machine
is ever sold, repurposed, given away, or has its drive replaced, **rotate the
Supabase service-role key** (Supabase dashboard → Project Settings → API →
service_role → Reset) and update Vercel, `.env.local` and hermes.

Add that to [`OWNER-ACTIONS.md`](OWNER-ACTIONS.md) if hermes ever changes hands.

---

## Recurring, after setup

- **Quarterly:** ask an agent to run the restore drill
  (`bash scripts/backup/restore_drill.sh <latest-snapshot>`) and record the result
  in [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md). A backup that has not been
  restored in a year is a guess.
- **If healthchecks.io emails you:** something broke that same night. See the
  troubleshooting section of [`HERMES-BACKUP-SETUP.md`](HERMES-BACKUP-SETUP.md).
- **Before any risky migration:** run `npm run db:snapshot -- --tag pre-migration-NN`
  from your own machine. This needs the PostgreSQL client tools installed on
  Windows (<https://www.postgresql.org/download/windows/>); add the installed
  `bin` folder to PATH.
