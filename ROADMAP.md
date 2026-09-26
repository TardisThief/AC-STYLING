# AC Styling — Engineering Roadmap

**Checkpoint: 2026-09-21.** The pre-content engineering push is closed. The
previous roadmap reached 749 lines and had started getting in the way of the
work; it is archived whole at
[`docs/archive/ROADMAP-2026-09-21.md`](docs/archive/ROADMAP-2026-09-21.md),
because the reasons recorded in it — especially why several things were
deliberately *not* done — outlast the task lists.

This file is deliberately short. **The next plan has not been written yet**;
see [Next planning session](#next-planning-session) at the bottom.

---

## Where the platform stands

Phases 0–3.6 are complete and deployed. In plain terms:

- **"Launch-ready" was wrong, and was reopened on 2026-09-26.** An external
  assessment ([`docs/archive/ENG_ASSESSMENT.MD`](docs/archive/ENG_ASSESSMENT.MD),
  2026-09-25) found real defects on the auth, email and payment path that the
  2026-09-19 findings (F01–F08, F10, F11, all still closed) did not cover. The
  six that blocked real money are fixed, each with a test that failed first:
  every auth email linked to a nonexistent `/auth/confirm` (AUTH-001); public
  signup marked unproven accounts verified, enabling pre-registration of a
  victim's address (SEC-001); any signed-in user could rewrite the homepage
  logos (SEC-002, migration 26); Resend refusals were reported as sent
  (MAIL-001); a retried guest delivery sent no welcome (PAY-002); checkout sold
  any Stripe price the browser named (PAY-004). Migrations are applied and
  verified through **26**. What is still open from it is listed below.
- **The Vault is populated but mostly parked.** 4 masterclasses, **21 modules**
  and 4 standalone courses, all bilingual. **Colorimetry is published and
  priced, so it is on sale, while all 21 modules are unpublished** — checked
  live 2026-09-26. Harmless while Stripe is in test mode; after the cutover it
  sells a masterclass with nothing playable (owner action 1c). Publishing is a
  flag flip in the admin console, not a re-import.
- **Launch offer is the Masterclass Pass** (2026-09-21, migration 19): every
  masterclass, current and future, alongside single masterclasses. Full Access
  and the Course Pass stay in the database but are switched off
  (`offers.active`) until the first standalone course ships; the sales page and
  Vault banner follow that switch with no code change.
- **Access is a one-year term, not a lifetime** (2026-09-24, migration 21).
  Renewal steps down in thirds — the price paid, then two thirds, then one third
  forever — and a lapse of over thirty days resets it to the current price.
  Everyone who bought before this keeps perpetual access; a null expiry means
  never, and there was no backfill. `/vault-access` also sells individual
  masterclasses now, and their price and published flag are editable in admin.
  Record: [`docs/RELEASE-2026-09-24-ACCESS-TERM.md`](docs/RELEASE-2026-09-24-ACCESS-TERM.md).
- **Adversarial test pass (2026-09-25/26).** Tests now try to break the guards,
  against the live schema in PGlite (`tests/integration/`), not just mocks. It
  found and fixed payment, access and Studio bugs (commits `4495467`..`9b780eb`;
  stance in CLAUDE.md § Adversarial testing). All users except the two admins
  were wiped on 2026-09-26 (`scripts/wipe_users.mjs`) to start testing clean.
- **Gates are green** as of 2026-09-26: `tsc` clean, lint 0 errors, the full
  vitest run (unit + PGlite integration) passing, production build passing,
  CI running all four. Run `npm run test:run` for the current count rather
  than trusting one written here.

## What actually holds up launch

Two content/owner things, plus the open assessment items below.

1. **No module video.** Every `video_id` reads `pending_video`. This is F09 —
   content, not engineering. Nothing can be published until real Vimeo IDs
   exist.
2. **Stripe is in the test sandbox.** The 11 `stripe_product_id` and 9
   `price_id` values in the database are test-mode, and IDs do not carry across
   modes. A real customer would pay and match nothing. This is owner action 1.
   Since 2026-09-24 the cutover has one more step: renewal prices are computed
   from `purchases`, so the 9 sandbox rows there must be cleared before the
   first real sale or they will quote real customers renewals priced off fake
   money.

**Still open from the 2026-09-25 assessment** (real, but not blocking the
first sale; each wants a failing test first, like the six above):

- **PAY-001** — the grant and "line item completed" are separate writes. A
  crash between them, re-claimed after 15 minutes, extends a term a second
  year. Narrow window; fix by recording the extending line item on the grant.
- **SEC-003** — a purchase claim is closed only from the update-password page;
  set a password any other way and the claim stays usable for its 24 hours.
- **OPS-001** — nothing alerts on a paid-but-unfulfilled purchase (F16's open
  half). The data is in `fulfillments`; nobody is told.
- **Restore scans only the last 100 checkout sessions** (`commerce.ts`), and
  the "Content Unlocked" toast shows even when nothing was restored.
- **CI runs Node 20; Puppeteer 25 needs ≥22.12** (owner action 6 for Vercel).
- Lower: Studio ownership/token/deletion lifecycle, renewal semantics across
  the three passes, `markAnswerAsRead` silently updating 0 rows under RLS,
  English-only auth screens and emails (F15), public lab questions/resources
  (a product decision), recovery rehearsal on a managed Supabase project.

Everything owner-only lives in [`docs/OWNER-ACTIONS.md`](docs/OWNER-ACTIONS.md)
— 12 items, kept there rather than here so that "what Claude does next" and
"what the owner does next" do not get shuffled together again.

## Parked, with reasons

Not abandoned. The full rationale is in the archive; the summary is that each
of these is cheaper or safer to do *after* content exists.

| | Why it waits |
|---|---|
| **Ops polish (CSP hardening)** | The policy is decorative today and the UI surface changes as content lands — exactly the churn that breaks a nonce policy. Harden once, against the settled surface. |
| **North-star features** (Style of the Week, Ale's Pick, boutique carousel) | These are editorial *surfaces* with no editorial content to put in them. Building them now means designing against placeholders. |
| **F12 — scale limits** | Guest resolution pages through at most 2,000 auth users. Real, invisible at 55 users, and it fires precisely when growth goes well. Belongs before a marketing push. |
| **F13 — E2E in CI** | The Playwright suite exists and is correct; wiring it into CI needs a test database, which is F16's dependency. |
| **F15 — ES parity and performance** | Best measured against real content and real copy. |
| **F16 — recovery and observability** | **Backup half DONE and proven 2026-09-25.** Nightly encrypted database + storage backups run on the owner's `hermes` host to Cloudflare R2, and the first restore drill passed 10/10 on snapshot `2026-09-25T001744Z` — restored whole, restored a single table, logins included ([`docs/DISASTER-RECOVERY.md`](docs/DISASTER-RECOVERY.md) carries the record). This mattered more than its "parked" status implied: the project is on the Supabase free tier, which has **no backups at all**. Still open: a staging database (F13 waits on it) and alerting on paid-but-unfulfilled purchases. |

## Next planning session

To be worked out after this checkpoint, deliberately not pre-decided here. The
open questions worth walking into it with:

- **Does content land before or after the Stripe cutover?** They are
  independent, and doing the cutover first means the first real publish is also
  the first real sale — worth deciding on purpose rather than by accident.
- **Which pillar launches first?** The archive records a masterclasses-first
  idea with the boutique and Style of the Week marked "coming soon". That is a
  positioning call for Ale, and it decides how much of the north-star set is
  even needed at launch.
- **`VAULT_REVEAL_UPCOMING` is on.** The catalogue currently shows as eight "In
  production" cards. That is a live marketing decision, not a technical one:
  quiet page, or visible pipeline.
- **What is the smallest publishable slice?** One masterclass with real video
  beats four parked ones, and it would exercise the whole paid path end to end
  for the first time with something real behind it.
- **F16 or growth first?** F16 is the responsible answer and F12 is the one
  that bites if launch goes well. Neither matters if nothing ships.
- **The renewal flow has never run.** It is unit-tested and no Stripe session
  has ever been created from it. The first person to exercise it should not be
  a customer.

---

*History, rationale and the record of what was considered and rejected:
[`docs/archive/ROADMAP-2026-09-21.md`](docs/archive/ROADMAP-2026-09-21.md).
The underlying findings: [`docs/ASSESSMENT-2026-09-19.md`](docs/ASSESSMENT-2026-09-19.md).*
