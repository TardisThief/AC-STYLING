# Owner actions

Things that cannot be done from the repository, because they live in a
dashboard, a DNS zone, or a mailbox only the owner can reach. Agents add rows
here instead of guessing or leaving the work implicit in a commit message.

Started 2026-09-20. Tick items off as they are done and note the date; if an
item turns out to be already handled, say so rather than deleting it, so the
next person does not re-check it.

Ordered by what blocks the most.

---

## 1. Stripe is still in the test sandbox — a live cutover is more than one key

Confirmed 2026-09-20: `STRIPE_SECRET_KEY` is an `sk_test` key, and the
catalogue in the database holds **test-mode identifiers**:

| Table | Rows with a `stripe_product_id` | Rows with a `price_id` |
|---|---|---|
| `masterclasses` | 1 of 3 | 1 |
| `chapters` | 6 of 20 | 6 |
| `offers` | 2 of 2 | 2 |
| `services` | 2 of 2 | — |
| **Total** | **11** | **9** |

**Stripe product and price IDs do not carry across modes.** A live `prod_…`
and a test `prod_…` are different objects, so flipping the secret key alone
leaves every one of those 20 identifiers pointing at something that does not
exist in live mode. `grantAccessForProduct` resolves a purchase by matching
the webhook's product id against those columns — so a real customer would pay
and match nothing.

**Cutover checklist, when you are ready to take real money:**

1. Recreate the products and prices in Stripe **live** mode.
2. Update all 11 `stripe_product_id` and 9 `price_id` values in the database to
   the live ids.
3. Set `STRIPE_FULL_ACCESS_PRODUCT_ID` to the **live** full-access product id.
   This one is currently absent from `.env.local` entirely. It is one of three
   paths that grant a full unlock; if it is unset *and* the `full_access` offer
   row is missing or inactive, **the buyer is charged and granted nothing**.
4. Swap `STRIPE_SECRET_KEY` to the `sk_live_…` key.
5. Create a **new webhook endpoint** in live mode and set `STRIPE_WEBHOOK_SECRET`
   to its signing secret. The test-mode secret will not verify live events, and
   the handler rejects anything that fails signature verification.
6. Make one real purchase end to end and confirm a row appears in
   `fulfillments` with `status = 'completed'`.
7. The `masterclass_pass` offer (added 2026-09-21, created from admin with the
   Stripe generator) is one of the rows in step 2: regenerate its product and
   price in live mode from the same admin form.
8. ~~**Clear the test-mode `purchases` rows**~~ — done 2026-09-26 by detaching them; see below. One line of SQL, and
   it has to happen before the first real sale.

Until then everything works exactly as it does now, in the sandbox.

### The renewal price is calculated from `purchases` — DONE 2026-09-26, differently

A renewal is two thirds, then one third, of what that customer actually paid,
read from her most recent `purchases` row where `is_renewal = false`. Sandbox
rows attached to an account would price real renewals off fake money.

**Done on 2026-09-26, as part of the owner's clean slate:** every purchase and
fulfilment row was *detached* (`user_id` set to NULL), not deleted, and every
grant and pass flag on the three remaining accounts was removed. Renewal
pricing reads by `user_id`, so detached rows can never price anything. Snapshot
before the change: `backups/pre-clean-slate--2026-09-26T163126Z`.

**Do not delete `fulfillments` rows** — not now, not at the cutover. The earlier
version of this item suggested it. A fulfilment row is the only record that a
paid Stripe line item was settled; delete it and Restore will grant that
purchase again to whoever signs up with the buyer's email (found by the owner
on 2026-09-26; see migration 32 and `scripts/ops/close_orphaned_sessions.mjs`).
After the cutover the live key cannot see test sessions, so the old rows are
harmless either way; keeping them costs nothing.

If a real sale ever lands before the cutover, nothing here needs undoing: it
attaches to its buyer as normal.

---

## 1b. ~~Allow the new auth-email destinations in Supabase~~ — confirmed 2026-09-26

**Checked against the dashboard (owner's screenshot, 2026-09-26):** the
Redirect URLs already include `https://www.theacstyle.com/**` and
`https://theacstyle.com/**`, which cover `/en/confirm`, `/es/confirm` and
`/{locale}/update-password`. No change was needed. Site URL is
`https://www.theacstyle.com`.

**Recommended on the same screen: remove `https://*.vercel.app/**`.** It
allows any site on vercel.app, not only ours, and Supabase's public auth
endpoint accepts a `redirect_to` from any caller as long as it matches the
list — so anyone could request a genuine login email for a customer that
sends her token to a vercel.app site they control. Keep
`https://ac-styling-livid.vercel.app/**`; add a specific preview address
only while testing on it. (The `localhost` entries only reach the
recipient's own machine: low risk.)

Original note, for reference:


Every auth email (magic-link login, signup, password reset, `/vault/join`)
used to send the reader to `/auth/confirm`, a page that does not exist
(AUTH-001 in the 2026-09-25 assessment). They now go to **`/en/confirm`** and
**`/es/confirm`** on the site the form was posted from, and the reset link
continues to `/{locale}/update-password`.

Supabase only redirects to URLs on its allow-list; anything else silently
falls back to the Site URL, which would land the reader on the homepage with
her login half-finished.

**How to check:** Supabase → Authentication → URL Configuration → Redirect
URLs. It needs to cover `https://www.theacstyle.com/en/confirm` and
`https://www.theacstyle.com/es/confirm` — a `https://www.theacstyle.com/**`
entry does — and the same for any preview domain you test auth on. Then send
yourself a magic link from `/es/login` and confirm it opens the Spanish
confirm page and signs you in.

## 1c. Colorimetry is on sale with nothing playable — decide before the cutover

Checked live 2026-09-26: the **Colorimetry masterclass is published and has a
price**, so the sales page and checkout sell it, but **all 21 modules are
unpublished and none has a video**. While Stripe is in test mode no one can
pay. The moment item 1 is done, a real customer could buy it and find nothing
to watch.

Either unpublish it in admin until its modules have video (F09), or do the
cutover only after content lands. Checkout now refuses anything the catalogue
is *not* selling, so unpublishing is enough to stop sales.

## 1d. ~~Schedule the paid-but-not-granted check on `hermes`~~ — done 2026-09-26 (owner)

`scripts/ops/check_fulfillments.mjs` finds every paid line item that was not
granted: rows left `failed` or stuck `processing`, and (with a Stripe key)
paid checkouts in the last 3 days with no finished fulfilment at all — a
webhook that never arrived. It is read-only and exits non-zero if it finds
anything. Until it runs on a schedule, the first person to learn that a
customer paid and cannot get in is the customer.

1. In healthchecks.io, create a **second** check (not the backup one), period
   30 minutes, grace 30 minutes. Copy its ping URL.
2. Add to `~/.ac-styling/.env.backup` on `hermes`:
   ```bash
   FULFILLMENT_HEALTHCHECK_URL="https://hc-ping.com/<the new uuid>"
   # Optional but recommended: enables the "webhook never arrived" check.
   # A restricted key with read access to Checkout Sessions is enough.
   STRIPE_SECRET_KEY="rk_live_..."
   ```
3. `crontab -e` and add:
   ```cron
   # AC Styling: paid-but-not-granted check, every 30 minutes
   */30 * * * * cd "$HOME/ac-styling" && set -a && . "$HOME/.ac-styling/.env.backup" && set +a && node scripts/ops/check_fulfillments.mjs >> "$HOME/.ac-styling/fulfillment-check.log" 2>&1
   ```

A failing run pings the check's `/fail` URL with the report, so the email says
which line items and whose. A missed run (hermes down) alerts through the
check's schedule. Run it once by hand first: it should print `OK`. Verified
read-only against production on 2026-09-26: OK.

## 2. Confirm the other Vercel environment variables

`NEXT_PUBLIC_SITE_URL` is missing from `.env.local` but **is set correctly in
Vercel** — verified against production on 2026-09-20: the canonical tag,
`og:url`, all three hreflang alternates and `robots.txt` all resolve to
`https://www.theacstyle.com`, which is the host the apex redirects to. Nothing
to do for production; add it locally if you want dev to match.

Also confirm these are present in Vercel, since they are only in `.env.local`
here: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`RESEND_API_KEY`, `DATABASE_URL`.

**How to check:** Vercel → Project → Settings → Environment Variables, for
Production *and* Preview.

---

## 2b. Set `VAULT_REVEAL_UPCOMING=true` to show the catalogue before it ships

**This is why `/vault-access` says "The first courses are being prepared."**
Nothing is broken. The section has two independent switches and both are
currently off:

1. Every course is `is_published = false` — deliberate, decided at import on
   2026-09-21, because no module has a Vimeo ID yet.
2. `VAULT_REVEAL_UPCOMING` is unset, so `app/[locale]/vault-access/page.tsx`
   filters the catalogue down to published rows only — which is none.

Setting the flag renders all four masterclasses and four standalone courses as
**"In production" cards**: real titles, subtitles and module lists, no price
and no way to buy. Verified locally on 2026-09-21 with the live database — all
eight appear, the empty state disappears, and `CatalogCard` has no checkout
button at all, so an unpublished course cannot be purchased by accident. The
flagship curriculum block and the single-course price both require a published
row, so both stay hidden until there is one.

**Status: set by the owner on 2026-09-21, as `TRUE`, All Environments.**

That spelling would not have worked. The code compared `=== 'true'` and
`'TRUE' !== 'true'`, so the flag was inert and the page would have stayed
empty with nothing in any log to explain it. Fixed in code rather than by
retyping the value — `isEnabled()` now accepts any reasonable spelling, and
the same trap was waiting on `VAULT_INDEXABLE` and
`NEXT_PUBLIC_VERCEL_ANALYTICS`. **Nothing to change in the dashboard.** The
flag is read at build time, so it takes effect on the next deploy.

Leave it unset if you would rather the page stay quiet until the videos exist.
That is a positioning call, not a technical one: the choice is between an
empty section and eight honest "coming soon" cards.

---

## 2b-bis. `BOUTIQUE_OPEN` — the boutique is closed for Release 1

Release 1 is the learning platform. While `BOUTIQUE_OPEN` is unset (the
default), `/vault/boutique` shows a "Coming soon" screen to members; admins
still see the real boutique so they can keep curating it from the admin tab.
The dashboard hides Style of the Week, Ale's Pick and the Pulse's "The Edit"
card from everyone, admins included, and the Boutique quick action reads
"Coming soon". Services and the Essence Lab are unaffected. No code or data was
removed. The switch lives in `app/lib/release.ts`.

**Nothing to do now.** When you decide to open the boutique, set
`BOUTIQUE_OPEN=true` in Vercel (All Environments) and redeploy.

---

## 2c. Review of the Vercel variables you shared (2026-09-21)

Checked every variable in the screenshot against every `process.env` read in
the codebase. Two worth acting on, two worth deleting, one worth confirming.

**`NEXT_PUBLIC_SITE_URL` is Production-only.** Preview deployments fall back to
the hardcoded `https://theacstyle.com` in `app/lib/seo.ts` and
`lib/email-templates.ts` — note the missing `www`, where production uses
`https://www.theacstyle.com`. Nothing crashes, but a password-reset or purchase
email triggered from a preview build sends the recipient to **production**, and
preview canonicals claim to be the production URL. Add it to Preview with the
preview host, or accept it knowingly.

**`DATABASE_URL` is in Production — worth removing.** No application code reads
it. It is used only by `scripts/` (migrations, QA helpers) and by the Postgres
client on your own machine; the app talks to Supabase over the REST API with
the anon and service-role keys. So a direct Postgres connection string is
sitting in the runtime environment of a public web app for no reason. Keep it
in `.env.local`, drop it from Vercel.

**`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is read by nothing.** Checkout is
redirect-based via `app/actions/stripe.ts`, so there is no client-side Stripe.js
to publish a key to. Dead variable; safe to delete.

**`STRIPE_FULL_ACCESS_PRODUCT_ID` is not in the list, and that is fine.** It
looked alarming — `app/lib/access-logic.ts` reads it to grant the full unlock —
but step 4 of `grantAccessForProduct` falls back to the `offers` table, and
both rows are live and correctly populated: `full_access` →
`prod_Tu058EMscR1XkA`, `course_pass` → `prod_Tu06etw8YLkfVm`, both `active`.
(Since 2026-09-21 the launch offer is `masterclass_pass`, and these two are
switched off in admin until the first course ships. An inactive offer is
skipped by step 4, so the env var matters again the day Full Access returns
*without* its row being re-activated.)
Verified against the production database. The env var is a redundant second
path, not the only one. Leave it unset or set it; either works.

**Confirm the pre-production Supabase values point at the live project.** The
`All Pre-Production Environments` copies of `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` were updated
Jul 10, while the Production copies were updated Feb 3 — so they are not the
same values. The old `pkmyth…` project is dead; if previews still point at it,
every preview deployment is broken in a way production is not. Worth one look.

**Intentionally absent, no action:** `VAULT_INDEXABLE` (the Vault stays
noindex until launch — item 1 and the Stripe cutover gate this) and
`NEXT_PUBLIC_VERCEL_ANALYTICS` (analytics stays off until Web Analytics is
switched on in the dashboard, otherwise every page load logs a MIME-type
error).

**Still test-mode:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, as
expected — see item 1.

---

## 3. Make `hello@theacstyle.com` deliver somewhere a human reads

Transactional email is sent from `AC Styling <hello@theacstyle.com>` and now
carries **no Reply-To header**, so every reply goes to that address.

It previously replied to the brand's Gmail address, which scored +2.503 on
mail-tester as `FREEMAIL_FORGED_REPLYTO` — a Reply-To on a freemail domain
that does not match the From domain looks exactly like phishing to a filter.
Removing it took the score from 7.6/10 to 10/10, so it is not coming back.

The root domain's mail runs on Hostinger (`v=spf1 include:_spf.mail.hostinger.com`),
so the mailbox or a forwarder should be created there.

**Either** create a real `hello@theacstyle.com` mailbox, **or** forward it to
the Gmail address. Once it exists, replies to purchase confirmations, password
resets and answer notifications will reach a person; today they land nowhere.

---

## 4. Email reputation — optional, worth doing before volume

Authentication is fully correct and verified (SPF, DKIM aligned to
`theacstyle.com`, DMARC, PTR, no blocklists, 10/10 on mail-tester). These are
improvements, not fixes.

- **Add `rua=` to the DMARC record.** It is currently `v=DMARC1; p=none` with
  no reporting address, so nobody is collecting aggregate reports and there is
  no visibility into who is sending as the domain. Example:
  `v=DMARC1; p=none; rua=mailto:dmarc@theacstyle.com`
- **Register the domain in Google Postmaster Tools** to see Gmail-side
  reputation. The first test landed in spam purely on cold-domain reputation;
  this is how that gets monitored rather than guessed at.
- **Consider tightening DMARC to `p=quarantine`** once reports show only
  legitimate sources — not before.

---

## 5. Check the Resend plan limits

The send response carried `x-resend-daily-quota: 1` and
`x-resend-monthly-quota: 2`. It is not documented whether those count sent or
remaining, and a send-only API key cannot query the account to find out. If
they are remaining, launch-day volume will hit a wall.

**How to check:** Resend dashboard → Usage, and confirm the plan's daily and
monthly limits against expected volume.

---

## 6. ~~Set Vercel's Node version to 22.x~~ — done in code 2026-09-26; confirm once

`package.json` now declares `"engines": { "node": "22.x" }`. Vercel uses that
in preference to the dashboard's Node.js Version, so the next deploy builds
and runs on Node 22 without a dashboard change. CI (`node-version: 22`) and
`.nvmrc` moved in the same commit, so CI tests the runtime production runs.
This closes ENV-001 from the 2026-09-25 assessment: Puppeteer 25 requires
Node ≥22.12.

Verified before the change, on Node 22.23.3: the full test suite, the
production build, and a Puppeteer headless launch.

**How to check (once):** the first deploy's build log should say it is using
Node 22.x. If the dashboard shows a warning that `engines` overrides its
setting, set the dashboard to 22.x too so the two agree.
---

## 7. ~~Decide whether a wardrobe should outlive the client who left~~ — decided 2026-09-26: **yes**

**Decision (2026-09-26):** a wardrobe outlives the client who leaves, and
so do its garments and lookbooks (confirmed the same day). Her personal data
— avatar, measurements, Lab answers — is still deleted. **Built and live
2026-09-26** (migration 33): garments, lookbooks and their photos stay with
the wardrobe, and photos follow a wardrobe that is reassigned. The privacy
notice now says so (EN and ES, section 8, 2026-09-26); it is part of item 9's
legal review.


When someone deletes their account, migration 15 now removes their profile,
progress, essence answers, wardrobe items, lookbooks, questions, grants and
tailor cards, plus their uploaded images.

**One thing was deliberately left alone:** `wardrobes.owner_id` is `SET NULL`,
so the wardrobe *container* survives as an unowned record rather than being
deleted. That is a retention decision, not a bug — a stylist-managed wardrobe
may legitimately outlive the client relationship — but it is a decision, and
right now it is implicit.

If the answer is "no, it should go too", it is a one-line migration. If the
answer is "yes", the privacy notice's deletion section should say so plainly,
because at the moment it implies everything goes.

**Two more things wait on the same answer** (2026-09-26). Account deletion
now removes every file under her own folder, sub-folders and avatar included,
but not photos uploaded through an intake link (stored under the wardrobe,
not under her), because those belong to the wardrobe. And when a stylist
reassigns a wardrobe from one client to another, photos already stored under
the first client's folder stay there. If wardrobes should go with the client,
both follow; if they stay, the photos should move with the wardrobe.

---

## 8. Confirm the testimonials are real and attributable

Carried over from Phase 3.5. The `Testimonials` component ships quotes that
nobody in the repository can verify. Unverifiable testimonials are the item on
these checklists that actually draws FTC complaints.

Needs a human who knows whether each quote is genuine, from a real client, and
used with permission.

---

## 9. Have the Spanish legal text reviewed

`PrivacyEs.tsx`, `TermsEs.tsx` and `RefundsEs.tsx` are a translation produced
by an agent, not legal review. They bind customers. The English remains the
authoritative version and the two must change together.

Ale or counsel should read the Spanish before launch.

**Updated 2026-09-26, please include in the review:** section 8 of the privacy
notice ("When you close your account" / "Cuando das de baja tu cuenta") and the
"Uploads" paragraph in section 1 were rewritten, in both languages, to say what
closing an account now keeps: a stylist-managed wardrobe with its garments,
photos and lookbooks, and purchase records for accounting. Two choices in that
text are worth confirming as yours: that a client can **ask for her wardrobe to
be deleted** (the notice promises this; it is done by hand on request), and the
feminine *la clienta* in the Spanish, which matches the rest of the site.

---

## 9b. Read the new Spanish copy — added 2026-09-26

The login, signup, forgot-password, confirm and `/vault/join` screens, their
error messages, and the sign-in, signup, password-reset and answer emails now
have Spanish versions (they were English only). They were drafted to match
the site's existing Spanish (tú, "invitada", "Bienvenida"). A native read
before launch is worth it: the `Auth` block in `messages/es.json`, the
`es` entries in `lib/email-templates.ts`, and `AUTH_ERRORS.es` in
`app/actions/auth.ts`.

## 10. Replace `public/logo.png` with a larger original — minor

150×150. It clears Google's 112×112 floor for the `Organization` logo in
structured data, but is not generous. Swap it if a larger original exists.

---

## Still blocking launch, but not owner-only

These are code work, tracked in `ROADMAP.md` and
`docs/ASSESSMENT-2026-09-19.md`, listed here only so the launch picture is in
one place.

- ~~**F06** — purchase-claim credential stayed valid after the email recovery
  path~~ — **fixed 2026-09-20**, migration 13 applied and verified.
- ~~**F05** — fulfillment could report success it did not achieve~~ —
  **fixed 2026-09-20**, migration 14 applied and verified. Per-line-item
  durable state, idempotent at the database, `payment_status` gate,
  `async_payment_succeeded` handling, and refund/dispute events recorded with
  an admin notification (access is *not* auto-revoked — that is a human
  decision, since the published policy is that sales are final).

- ~~**F11** — account deletion did not delete~~ — **fixed 2026-09-20**,
  migration 15.
- ~~**F10** — guest-upload and wardrobe-claim boundaries~~ — **fixed
  2026-09-20**, migration 16. Upload paths are bound to their wardrobe, the
  claim is atomic, tokens are no longer logged, intake links expire after
  **7 days**, and a wardrobe caps at 500 items. The cap lives in code
  (`app/lib/wardrobe-tokens.ts`) so it can be lowered without a migration once
  there is real usage to size it against.
- **F12–F16** remain open: the 2,000-account lookup ceiling in guest
  resolution, test coverage of the highest-consequence boundaries, deployed-vs-
  source drift, bilingual/performance polish, and observability. **F16's backup
  half is done and proven** (item 13), and the credential question it raised is
  closed by owner decision (13b).

- **2026-09-25 external assessment**
  ([`docs/archive/ENG_ASSESSMENT.MD`](archive/ENG_ASSESSMENT.MD)): it found
  six money-path defects the list above did not cover. All six are **fixed
  2026-09-26** (AUTH-001, SEC-001, SEC-002/migration 26, MAIL-001, PAY-002,
  PAY-004). The rest of its findings are real but not launch-blocking; they
  are listed in `ROADMAP.md` under "Still open from the 2026-09-25 assessment".

**With that, every *launch-blocking* code finding in both assessments is closed.** What remains
between here and launch is on this page, plus **F09**: none of the 25
modules and courses has a usable video yet (checked 2026-09-26), which no amount of code can fix.
- ~~**F07** — SSRF validation only checked the first destination~~ — **fixed
  2026-09-20**. Every redirect hop is now re-validated, four address bypasses
  closed (including IPv4-mapped IPv6 loopback), and the remote-image upload
  gained a size cap, timeout and content-type allowlist. Residual, documented:
  DNS rebinding is not fully closed, because pinning needs a connect-to-IP with
  an explicit Host header that Node's fetch does not expose.
- ~~**F08** — Next.js inside current advisory ranges~~ — **already fixed**.
  `next` and `eslint-config-next` were moved 16.1.3 → **16.3.5** in `cb65711`,
  above the 16.3.3 the cited advisories require. The audit discrepancy the
  assessment told us to investigate has since resolved itself into a real
  finding: four high-severity issues in the Puppeteer/`extract-zip` chain,
  fixed 2026-09-20 by upgrading `puppeteer` 24.43.1 → 25.11.0. `npm audit` now
  reports 0.

---

## 13. Nightly backup — DONE 2026-09-25

**Added 2026-09-23. Set up and proven by a restore drill.** Nothing here is
blocking. The credential question its setup raised is closed (13b).

The Supabase project is on the **free tier**, which includes no backups of any
kind: no daily snapshot, no dashboard restore, no point-in-time recovery. This
was assumed rather than checked until now. In practice it means that if the
project were deleted, corrupted, or a migration went wrong, the only surviving
artifacts would be a schema file from July and a JSON export of two tables.
Every account, purchase, client wardrobe and uploaded photograph would be gone,
and the private `studio-wardrobe` images are not re-fetchable from anywhere.

**That is now fixed.** The `hermes` host runs `scripts/backup/backup.sh` nightly
at 03:17, dumping the database (`public` + `auth` + `storage`) and mirroring all
four storage buckets to its SSD, then pushing an encrypted copy to Cloudflare R2.
The first restore drill passed 10/10 on snapshot `2026-09-25T001744Z`: restored
whole, restored a single table on its own, `auth.users` included. The record is
in [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md).

Both follow-ups are **confirmed done 2026-09-25**: the healthcheck is receiving
its nightly ping and is set to daily with grace, and the quarterly drill is in
the calendar. Nothing on this item is outstanding.

The quarterly routine, for whoever picks it up:

```bash
bash scripts/backup/restore_drill.sh   $(ls -d /mnt/backup/ac-styling/db/*/ | tail -1)
bash scripts/backup/verify_storage.sh  /mnt/backup/ac-styling/storage-mirror
```

Add the result to the drill table in [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md).

**Done 2026-09-26 (owner): drill the next nightly.** Until today no backup
contained the database privileges that make up the app's security model (see
"Privileges" in [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md)). The dump
scripts now keep them. Once `hermes` has pulled the change, run
`bash scripts/backup/restore_drill.sh <that night's snapshot>` there: it
should pass, including the five privilege checks. Older snapshots need
`DRILL_LEGACY_PRIVILEGES=1` and, in a real restore, the baseline step in the
runbook.

Reference, now that it is running: [`BACKUP-OWNER-SETUP.md`](BACKUP-OWNER-SETUP.md)
is how it was set up, [`HERMES-BACKUP-SETUP.md`](HERMES-BACKUP-SETUP.md) is the
`hermes` side including troubleshooting, and
[`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md) is what to read when something
has actually gone wrong.

---

## 13b. ~~Rotate the backup credentials~~ — CLOSED 2026-09-25, owner decision

During the `hermes` setup the database password, the Supabase service-role key
and the R2 API keys passed through an agent session log. The R2 token was
rotated on 2026-09-25. **The owner has decided not to rotate the database
password or the service-role key. This is settled — do not reopen it or
re-raise it in a later session.**

For accuracy, since the next person will otherwise spend time working it out:
the old database connection string and the old service-role key are, as far as
anyone checked, still valid. On legacy JWT projects `service_role` has no
independent revoke — it stops working only when the project's JWT secret is
rotated or the project moves to the new API keys — so replacing the displayed
key would not have revoked the old one anyway.

**Do not rotate the rclone crypt password or salt.** Unrelated to the above and
genuinely dangerous to change: every archive already in R2 becomes permanently
unreadable. They belong in the owner's password manager, and specifically not
only on `hermes`, because the point is to be able to restore when `hermes` is
gone.

**If a nightly backup fails after any future credential change,** the usual
cause is one consumer still holding an old value: `~/.ac-styling/.env.backup`
on `hermes`, its `r2raw` rclone remote, Vercel's environment variables, or the
local `.env.local`. The healthcheck is what tells you.

**Standing consequence:** `hermes` holds the service-role key, so it can read
the entire database and every client photograph. Relevant if that machine is
ever sold, repurposed or has its drive replaced.

**Worth considering separately:** Supabase Pro ($25/month) adds daily
platform-level backups with 7-day retention, restorable from the dashboard.
The self-hosted backup above is more capable in one important way — it can
restore a single table, and it covers the storage buckets, which the platform
backups do not self-serve — but the two are complements, not substitutes. A
budget call, not a technical one.
