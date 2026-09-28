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
  any Stripe price the browser named (PAY-004). The rest of its findings were
  then worked through the same way (below). Migrations are applied and
  verified through **34**; the code is deployed.
- **The Vault is populated but mostly parked.** 4 masterclasses, **21 modules**
  and 4 standalone courses, all bilingual. **Colorimetry is published and
  priced, so it is on sale, while none of its 5 modules is published or has a
  video** — checked live 2026-09-26, recounted 2026-09-28 (the 21 modules are
  Body Shape 6, Closet Curation 4, Colorimetry 5, Style & Essence 6). Harmless while Stripe is in test mode; after the cutover it
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
   (Renewal prices are computed from `purchases`, so the sandbox rows there had
   to go before the first real sale: done 2026-09-26, detached rather than
   deleted.)

**Also fixed on 2026-09-26, from the same assessment's second tier:**
a crashed fulfilment run re-granting a year on retry (PAY-001, migration 27);
the welcome fast lane staying usable after she had signed in some other way
(SEC-003); Restore missing purchases behind 100 newer checkouts, and the
"Content Unlocked" toast shown when nothing was found; and a read-only
paid-but-not-granted check (`scripts/ops/check_fulfillments.mjs`, OPS-001)
that alerts once the owner schedules it (owner action 1d).

**Lower-priority findings, also closed on 2026-09-26** (each with a test that
failed first): Node 22 everywhere (ENV-001); renewing a pass taken off sale,
and quoting the item she can still renew (PAY-005); answer dismissal and
Studio writes that reported success while changing nothing (UX-001/002);
intake links that never expired, unlimited upload URLs, a third wardrobe, and
a non-atomic assignment (STUDIO-001/002, migration 28); the notification
inbox policy naming a deleted account (migration 29); guest lookups that
stopped at the 2,000th account (SCALE-001, migration 31); account deletion
missing nested, overflow and avatar files (DATA-001); every member email and
the auth screens and errors in Spanish (I18N-001); and paid Lab questions and
downloads made paid-only (MEDIA-001, migration 30).

**Recovery (OPS-002) turned up the most serious finding of the pass:** no
backup contained any privileges, and even with them a straight restore into
Supabase reopens every locked column. Fixed and drilled on 2026-09-26: see
"Privileges" in [`docs/DISASTER-RECOVERY.md`](docs/DISASTER-RECOVERY.md).

**Found by the owner after the pass, same day:** Restore handed a wiped
account's old guest purchase (Full Access) to a new account with the same
email, because deleting an account deleted the record that its line items were
settled. Owner decision: deleting an account closes its purchases. Fixed by
migration 32 (sales rows are kept, detached), a Restore check that skips
refunded or disputed charges, and `scripts/ops/close_orphaned_sessions.mjs`,
which closed the 11 paid line items that earlier deletions had already
orphaned. Then, at the owner's request, a **clean slate**: every grant, pass
and purchase removed from the three remaining accounts (rows detached, not
deleted), so testing starts from no purchases at all.

**Deployed 2026-09-26:** `main` pushed and live, then migration 30 applied
and the one live download (Colorimetry's PDF) moved into the private bucket;
records in `supabase/migrations/README.md`. Checked by the owner the same day: a module page as a member with access
(resources and Lab load) and as one without (question count only) behave
as intended.

**Paid-path rehearsal, 2026-09-28** (live site, Stripe test mode; complete,
record at `docs/REHEARSAL-2026-09-28.md`). Every money path ran once for
real: both guest checkouts, a signed-in purchase, the whole renewal ladder
($150 → $100 → $50), grace, lapse and reset, a refund, and account deletion. Found and fixed the same day,
each with a test that failed first: after a password login the Profile link
pointed at `/vault/join` until a reload (a prefetched signed-out Vault layout;
every browser-side sign-in and sign-out now does a full load); `/welcome`
promised an existing member an email that is never sent; the Stripe test
webhooks were not subscribed to refund or dispute events, so that admin alert
had never fired (cutover checklist updated); and a buyer with an existing
account got no email at all, now a branded receipt sent exactly once per
checkout (migration 34); a signed-in member buying from `/vault-access` went
through the guest checkout, so a mistyped email would have sent her purchase
to another account (now decided at click time), and two sales-path links led
members to the signup form. Closed the same day: the sales page no longer
sells a member what she already holds, no longer offers her "Log in as a
guest", and now has a sign-in link for returning clients.

**Still open, and why:**

- **Scenario 3 against a real new Supabase project** has not been run; its
  ordering was checked against a snapshot's table of contents.
- ~~**Studio screens, journal feedback and service-purchase messages** in
  English~~ — **done 2026-09-28** for everything a client sees (`MyStudio`,
  `Journal`, `Studio` in `messages/*.json`; `tests/unit/client-studio-i18n.test.tsx`).
  The stylist-only screens stay English (owner decision). Doing it turned up
  that a client's own wardrobe showed the stylist's tools, including a
  "Change Image" that her update action refuses while the screen said
  "Image Updated": she now gets one "add a photo" of her own
  (`getMyItemUploadUrl` / `addMyWardrobeItem`,
  `tests/integration/my-wardrobe-upload.test.ts`), and the stylist's tools are
  hidden from her. Still open: the Calendly embed is not locale-specific, and
  the live service rows carry placeholder copy (content).
- **A wardrobe outlives the client who leaves, garments and lookbooks
  included** (owner decisions, 2026-09-26) — **built and live** (migration 33,
  `6ff30f6`). A deleted client's garments and lookbooks stay in the wardrobe,
  and its photos move to `wardrobe/<id>/`, where the bucket policy lets the
  wardrobe's current owner and admins read them; the same move happens when a
  wardrobe is reassigned. What is hers alone still goes: avatar, measurements,
  Lab answers, progress, and garments or lookbooks in no wardrobe. The
  privacy notice says so in EN and ES (section 8, updated 2026-09-26,
  `d4564f2`), including that purchase records are kept and that a client
  can ask for her wardrobe to be deleted; it is a draft awaiting owner
  action 9's legal review.
- ~~44 intake photos from wiped wardrobes~~ — removed 2026-09-26 with
  `scripts/cleanup_orphaned_wardrobe_files.ts` (dry run first: all 44 under
  `wardrobe/<id>/` of wardrobes the wipe removed, none referenced). The
  `studio-wardrobe` bucket is now empty; a re-run finds 0.
- **No database migration is planned.** The next one would be 35; none of
  the open items needs one. When one is planned it is written up in
  `supabase/migrations/README.md`, like 26–34.
- **PAY-001's limit:** only the last line item is remembered on a term, so a
  crash followed by a different purchase on the same term inside the
  15-minute window could still double. Recorded in migration 27.
- **SEC-004** (the scraper's browser subrequests are checked by address, not
  by resolved DNS) and **ARCH-001** (handwritten types, the dual lookbook
  representation): real, admin-only or structural; parked.

Everything owner-only lives in [`docs/OWNER-ACTIONS.md`](docs/OWNER-ACTIONS.md)
— kept there rather than here so that "what Claude does next" and
"what the owner does next" do not get shuffled together again.

## Parked, with reasons

Not abandoned. The full rationale is in the archive; the summary is that each
of these is cheaper or safer to do *after* content exists.

| | Why it waits |
|---|---|
| ~~**Ops polish (CSP hardening)**~~ | **Enforced 2026-09-28** (`lib/csp.mjs`). The Report-Only policy had no report endpoint, so it never reported anything; Safari said on every page that it had no effect, and `frame-ancestors` was ignored. Enforcing it needed two sources the report-only mode had hidden: the Vimeo player's oEmbed lookup and the project's own Supabase origin. `tests/e2e/csp.spec.ts` walks the main pages for violations in Chromium and WebKit. Still parked: nonces instead of `'unsafe-inline'`, once the pages settle. |
| **North-star features** (Style of the Week, Ale's Pick, boutique carousel) | These are editorial *surfaces* with no editorial content to put in them. Building them now means designing against placeholders. |
| ~~**F12 — scale limits**~~ | **Fixed 2026-09-26** (SCALE-001, migration 31): guest resolution finds an account by email directly instead of paging through at most 2,000 auth users. |
| ~~**F13 — E2E in CI**~~ | **Done 2026-09-28.** The `e2e` CI job runs Playwright (Chromium + WebKit) against a local Supabase in Docker built from the baseline, `supabase/platform.sql` and a seed (`npm run test:e2e:local-db` locally). It includes signed-in journeys for the rehearsal's fixes. Building it found that the baseline omits everything we own outside `public` (the profile trigger, buckets, storage policies): now `supabase/platform.sql`, with `npm run db:platform:check` for drift. |
| **F15 — ES parity and performance** | Best measured against real content and real copy. |
| **F16 — recovery and observability** | **Backup half DONE and proven 2026-09-25.** Nightly encrypted database + storage backups run on the owner's `hermes` host to Cloudflare R2, and the first restore drill passed 10/10 on snapshot `2026-09-25T001744Z` — restored whole, restored a single table, logins included ([`docs/DISASTER-RECOVERY.md`](docs/DISASTER-RECOVERY.md) carries the record). This mattered more than its "parked" status implied: the project is on the Supabase free tier, which has **no backups at all**. Alerting on paid-but-unfulfilled purchases is also done (`scripts/ops/check_fulfillments.mjs`, scheduled on `hermes` 2026-09-26, owner action 1d). Still open: a staging database (F13 waits on it). |

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
