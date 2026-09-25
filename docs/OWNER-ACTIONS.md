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
8. **Clear the test-mode `purchases` rows** — see below. One line of SQL, and
   it has to happen before the first real sale.

Until then everything works exactly as it does now, in the sandbox.

### The renewal price is calculated from `purchases`, so sandbox rows are not harmless

Added 2026-09-24, with the one-year access term (migration 21). This is new, and
it is the only part of the cutover that involves customer money going *out*
rather than in.

A renewal is not a fixed price. It is two thirds — then one third — of what that
customer actually paid, read at checkout from her most recent row in
`purchases` where `is_renewal = false`. The table holds **9 rows today, all of
them test-mode**, created while exercising the sandbox.

Those rows are fake money, and after the cutover they would be indistinguishable
from real ones. A customer whose test row says she paid $1 would be quoted a
renewal of 67¢ — and we would honour it, because the code has no way to know the
difference. The failure is quiet: nothing errors, the charge simply comes out
wrong, and it stays wrong for every renewal after it.

**Before the first live sale**, delete the sandbox purchase history:

```sql
-- Check first. Every row should be one you recognise from testing.
SELECT id, user_id, product_id, amount_paid, currency, created_at
FROM public.purchases ORDER BY created_at;

DELETE FROM public.purchases WHERE created_at < '<the cutover date>';
```

The same applies to `fulfillments` if you want the two to agree, though only
`purchases` feeds the renewal price. Access already granted is unaffected: it
lives on `profiles` and `user_access_grants`, not here.

**The assumption this is written under**, stated so it can be corrected: the
Stripe move to live mode and real money happens *before* launch, so no genuine
customer exists yet and there is nothing of value in these rows. If a real sale
somehow lands first, do not run the delete — remove only the rows you can
identify as test purchases.

---

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

## 6. Consider setting Vercel's Node version to 22.x — not urgent

`puppeteer@25` declares `engines: { node: ">=22.12.0" }`, and this project
declares no `engines` field, so production runs whatever the Vercel dashboard
is set to.

**This is not currently broken.** Puppeteer 25 was tested on Node 20.19.4
locally — browser launch, the stealth plugin, request interception and
navigation all work — so the requirement is advisory rather than enforced. No
`engines` constraint was added to the repo precisely because declaring
`>=22.12.0` could *fail* your build if the dashboard is pinned to 20.x, which
would be a worse outcome than an unsupported-but-working runtime.

Worth aligning when convenient, since running a dependency outside its
supported range means upstream will not treat any resulting bug as theirs.

**How to check:** Vercel → Project → Settings → General → Node.js Version.

---

## 7. Decide whether a wardrobe should outlive the client who left

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

---

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
  half is done and proven** (item 13); what it left behind is a credential
  rotation, item 13b.

**With that, every *launch-blocking* code finding in the assessment is closed.** What remains
between here and launch is on this page, plus **F09**: the five published Vault
modules still have no usable video, which no amount of code can fix.
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

## 13. Nightly backup — DONE 2026-09-25, but rotate the secrets

**Added 2026-09-23. Set up and proven 2026-09-25.** The remaining action is
credential rotation, in section 13b below — do that one this week.

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

Two small things still to confirm, neither urgent:

1. **Check tonight's healthcheck ping arrives**, then set the check to daily with
   a few hours of grace so a missed night actually alerts you.
2. **Put a quarterly reminder in your calendar** to run the restore drill — the
   scripts do not schedule it:
   `bash scripts/backup/restore_drill.sh $(ls -d /mnt/backup/ac-styling/db/*/ | tail -1)`

Step-by-step instructions: [`BACKUP-OWNER-SETUP.md`](BACKUP-OWNER-SETUP.md)
(about 30 minutes). The agent-facing half is
[`HERMES-BACKUP-SETUP.md`](HERMES-BACKUP-SETUP.md), and recovery procedures are
in [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md).

---

## 13b. Rotate the backup credentials — do this one this week

During the `hermes` setup the **database password, the Supabase service-role key
and the R2 API keys all passed through an agent session log**. Session logs are
not a secure store: they sit on disk, they can be copied, and they outlive the
work. Treat those three secrets as exposed and rotate them.

The service-role key is the one that matters most — it bypasses every RLS policy
in the database, so it can read and write every account, purchase and client
photograph regardless of who is asking.

In order:

1. **Supabase → Project Settings → Database → Reset database password.**
2. **Supabase → Project Settings → API → `service_role` → Reset.**
3. **Cloudflare → R2 → Manage R2 API Tokens →** roll the token for
   `ac-syling-backups`.
4. Update each place the old values live: **Vercel** environment variables, your
   local **`.env.local`**, and **`~/.ac-styling/.env.backup`** plus the `r2raw`
   rclone remote on `hermes`. The agent on that machine can do its own file if
   you send it the new values — over something private, not a chat log you would
   not want retained.
5. Run one backup by hand afterwards to confirm nothing broke:
   `bash scripts/backup/backup.sh --no-pull`

**Do not rotate the rclone crypt password or salt.** Those are not exposed the
same way, and changing them makes every archive already in R2 unreadable. They
belong in your password manager and nowhere else — in particular, not only on
`hermes`, because the entire point is to be able to restore when `hermes` is gone.

**Standing consequence:** `hermes` holds the service-role key, so it can read the
entire database and every client photograph. If that machine is ever sold,
repurposed or has its drive replaced, rotate again and update all three places.

**Worth considering separately:** Supabase Pro ($25/month) adds daily
platform-level backups with 7-day retention, restorable from the dashboard.
The self-hosted backup above is more capable in one important way — it can
restore a single table, and it covers the storage buckets, which the platform
backups do not self-serve — but the two are complements, not substitutes. A
budget call, not a technical one.
