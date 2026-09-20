# Owner actions

Things that cannot be done from the repository, because they live in a
dashboard, a DNS zone, or a mailbox only the owner can reach. Agents add rows
here instead of guessing or leaving the work implicit in a commit message.

Started 2026-09-20. Tick items off as they are done and note the date; if an
item turns out to be already handled, say so rather than deleting it, so the
next person does not re-check it.

Ordered by what blocks the most.

---

## 1. Confirm the Vercel environment variables — **blocking a real launch**

`.env.local` is missing two variables that the code reads. Locally they fall
back or go unused, so nothing breaks here; in production one of them silently
changes who gets access.

| Variable | Why it matters if missing in Vercel |
|---|---|
| `STRIPE_FULL_ACCESS_PRODUCT_ID` | One of three paths in `grantAccessForProduct` that grants a full unlock. If unset, a full-access purchase falls through to the `offers` lookup; if that row is absent or inactive, **the buyer is charged and granted nothing**. |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for checkout returns, the set-password link in the purchase email, `sitemap.xml`, `robots.txt` and every canonical tag. Falls back to `https://theacstyle.com`, which is right today, but only by luck on preview deployments. |

Also confirm these are present in Vercel, since they are only in `.env.local`
here: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`RESEND_API_KEY`, `DATABASE_URL`.

**How to check:** Vercel → Project → Settings → Environment Variables, for
Production *and* Preview.

---

## 2. Make `hello@theacstyle.com` deliver somewhere a human reads

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

## 3. Email reputation — optional, worth doing before volume

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

## 4. Check the Resend plan limits

The send response carried `x-resend-daily-quota: 1` and
`x-resend-monthly-quota: 2`. It is not documented whether those count sent or
remaining, and a send-only API key cannot query the account to find out. If
they are remaining, launch-day volume will hit a wall.

**How to check:** Resend dashboard → Usage, and confirm the plan's daily and
monthly limits against expected volume.

---

## 5. Consider setting Vercel's Node version to 22.x — not urgent

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

## 6. Confirm the testimonials are real and attributable

Carried over from Phase 3.5. The `Testimonials` component ships quotes that
nobody in the repository can verify. Unverifiable testimonials are the item on
these checklists that actually draws FTC complaints.

Needs a human who knows whether each quote is genuine, from a real client, and
used with permission.

---

## 7. Have the Spanish legal text reviewed

`PrivacyEs.tsx`, `TermsEs.tsx` and `RefundsEs.tsx` are a translation produced
by an agent, not legal review. They bind customers. The English remains the
authoritative version and the two must change together.

Ale or counsel should read the Spanish before launch.

---

## 8. Replace `public/logo.png` with a larger original — minor

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

**With that, every code blocker in the assessment is closed.** What remains
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
