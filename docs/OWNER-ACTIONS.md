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

Until then everything works exactly as it does now, in the sandbox.

---

## 2. Confirm the other Vercel environment variables

`NEXT_PUBLIC_SITE_URL` is also missing from `.env.local`. It is the canonical
URL for checkout returns, the set-password link in the purchase email,
`sitemap.xml`, `robots.txt` and every canonical tag. It falls back to
`https://theacstyle.com`, which is right today, but only by luck on preview
deployments.

Also confirm these are present in Vercel, since they are only in `.env.local`
here: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`RESEND_API_KEY`, `DATABASE_URL`.

**How to check:** Vercel → Project → Settings → Environment Variables, for
Production *and* Preview.

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
  source drift, bilingual/performance polish, and backup/observability.

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
