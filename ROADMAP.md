# AC Styling — Engineering Roadmap

Status as of 2026-09-19. See `AUDIT.md` for the security audit this follows from,
and `supabase/migrations/README.md` for DB state.

## September assessment — Product owner review and execution tracking

The [repository and ecosystem assessment](docs/ASSESSMENT-2026-09-19.md)
adds findings F01–F16 backed by live schema inspection and public browser checks.
**The historical P0/P1 closure below is not a current security clearance.**
Keep completed fixes in the history; track the newly found gaps separately.

Product owner comments for consideration:

- Put database authorization and reliable payment delivery ahead of Phase 4
  editorial/personalization work. A polished sales page alone is not launch readiness.
- Existing backlog already covers video/live Stripe, legal translations, shared
  animation cost, hero image loading, error boundaries, skeletons, and CSP.
  The handover remains the owner of content/payment launch configuration.
- Revisit the scope of completed SSRF, email-limiting, payment-idempotency,
  accessibility, and account-deletion work against F02/F05/F07/F11/F14.
  This does not undo the fixes already shipped.
- Metadata, booking content, and consent are implemented in source; verify their
  actual production deployment (F14) before marking the release verified.
- Translation work remains with the other agent. Security work must avoid legal
  copy and translation files and coordinate shared-file changes before editing.

### Dependency checks and current status

DB access reconfirmed 2026-09-19: direct PostgreSQL connection as `postgres`,
26 public tables and 72 public/storage policies, schema-management privileges
and ability to test application roles. Inspection used `BEGIN READ ONLY`.
This is the shared production instance. Live Vercel settings, Vimeo playback
restrictions, email delivery, and backup restoration remain unverified.

| Priority | Assessment | Dependencies / acceptance | Progress |
|---|---|---|---|
| Immediate | F01–F04: profile privileges, RPC execution, boutique/storage policies | Deploy coordinated server actions BEFORE migration 12; agent applies SQL; verify roles and upload behavior in production | Implemented locally: migration 12, trusted admin actions, TailorCard action, verified restoration identity. PostgreSQL role tests pass. Agent migration authority confirmed 2026-09-19; coordinated release in progress. **Not yet deployed or applied to DB.** |
| Immediate | F08: patched Next.js | Align Next and eslint-config-next; verify Node/React requirements; lint, tests, typecheck, production build | Updated and pinned to 16.3.5; compatible dependency fixes installed. Tests, lint, build TypeScript checks, and production build pass locally. Not deployed. Four Puppeteer/extract-zip high findings remain; no forced downgrade. |
| Before payments | F05–F07: fulfillment, claim lifecycle, SSRF | Requires protected entitlements; durable replay-safe grants; all password-setting paths; safe remote-image delivery | Queued after authorization dependencies |
| Before promotion | F09/F14: real content/live payments and deployed behavior | Alejandra's videos, owner-managed Stripe/Vimeo, deployment verification; preserve noindex until complete | Open; see Vault handover |
| Release assurance | F10–F13: token boundaries, deletion, restoration, integration tests | Role tests and purchase model first; retention decision before deletion changes | F13 partially implemented: 31 isolated PostgreSQL authorization tests now included in CI. F10–F12 remain open, including restoration's 100-session limit. |
| Stabilization | F15–F16: localization, performance, recovery/operations | Translation coordination; measured performance; recoverable schema/storage and alerts | Open; translations handled separately |

Progress entries distinguish **implemented**, **validated locally**, **applied to
DB**, **deployed**, and **verified in production**. A passing unit test or a SQL
file alone does not close a live finding. Update this table at each milestone.

**2026-09-19 implementation checkpoint:**
[release dependencies, sequence, and smoke checks](docs/RELEASE-2026-09-19-AUTHORIZATION.md)
are ready for review. Full suite: **38 files / 320 tests passed**; lint:
**0 errors / 159 existing warnings**. Production build and its TypeScript checks
pass; the existing `metadataBase` fallback warning remains. Read-only production verification still
fails 12 authorization/configuration checks as expected before migration 12;
wardrobe privacy passes. No live data/configuration was changed. Next work is
F05–F07; fulfillment must also reconcile the live trigger's price-ID/product-ID
mismatch and propagate failed grants. Translation/legal files remain with the
other agent.

## Done & deployed

**Historical July P0/P1 work recorded as deployed; September findings are tracked above:**
auth guards, service-role leak fixes, SSRF guards, open-redirect fix, security
headers, mock-checkout removal; DB migrations 01–07 applied (handle_new_user
hardening, partner_brands column grants, studio-wardrobe lockdown, email
`rate_limits`, `stripe_processed_events`, lookbooks canvas columns, owner-or-admin
studio-wardrobe policy); partner_brands public/admin read split; signed-URL
wardrobe images; email rate limiting; Stripe webhook idempotency; CI
(`.github/workflows/ci.yml`) with a green 223-test suite; npm audit 20→2; schema
baseline (`supabase/migrations/00000000000000_baseline.sql`); Next 16
`serverActions.bodySizeLimit` upload fix; vault-assets direct-to-storage upload +
Vimeo teaser handling.

**Phase 1 — Robustness & Correctness — complete (2026-07-12):**

- ~~**zod input validation** on server actions~~ — **done (2026-07-10)** for the
  admin write layer: `app/lib/validation/` (parseInput + per-domain schemas),
  the five `manage-*` actions validate at the boundary, mass assignment in the
  offers/services upserts closed, chapter JSON crash path fixed, inline admin
  checks in those files consolidated onto `requireAdmin`. Broader rollout to
  non-admin actions rides the P2 `any` cleanup.
- ~~**Wardrobe storage folder normalization**~~ — **done & deployed
  (2026-07-12)**. Studio components (`VirtualWardrobe`, `TailorCard`,
  `DigitalLookbook`, admin `ClientDossier`) take an explicit `{ wardrobeId,
  ownerId }` pair instead of the ambiguous `clientId`; the `user_id: clientId`
  corruption and the empty client-wardrobe/lookbook views are fixed; all uploads
  route through `lib/wardrobe-paths.ts`; guest intake uploads go
  direct-to-storage (no Vercel 4.5 MB cap); lookbooks work against the real
  schema. Migrations 06 + 07 applied; `scripts/verify_wardrobe_policy.ts` passes
  6/6 against prod (owner-or-admin isolation confirmed). Spec + plan:
  `docs/superpowers/{specs,plans}/2026-07-11-wardrobe-storage-normalization*`.
  Remaining optional cleanup: `scripts/cleanup_orphaned_wardrobe_files.ts` (44
  orphaned files, dry-run first).

## Phase 2 — Code Health & Dev Velocity (current)

- ~~`no-explicit-any` cleanup → flip CI's lint step to a blocking gate~~ —
  **done (2026-07-14, unmerged on Dev)**. The "~1500 errors" were mostly ESLint
  linting gitignored tooling dirs (`claude-mem/`, `superpowers/`, `impeccable/`);
  scoping ESLint to `.gitignore` via `@eslint/compat` removed ~1,250, leaving
  ~250 real app-source errors, all now fixed: `no-explicit-any` (shared row
  types in `app/lib/types.ts` + `getErrorMessage` helper; `tests/**` relaxed),
  `no-unescaped-entities`, `no-html-link-for-pages` (→ i18n `Link`), and the
  react-hooks rules (incl. a real rules-of-hooks bug in `InteractiveGate`).
  `npm run lint` is now 0 errors and CI enforces it. Warnings (~9k, mostly
  `no-img-element`) stay non-blocking — a separate future effort. Spec + plan:
  `docs/superpowers/{specs,plans}/2026-07-12-lint-to-blocking-gate*`.
- ~~De-duplicate the profile-merge logic + remaining inline admin checks~~ —
  **done (2026-07-14)**. 15 admin actions consolidated onto `requireAdmin`;
  dead `invitation.ts` `claimWardrobe` duplicate removed.
- ~~Tailwind token consolidation (brand tokens vs. dead shadcn oklch); dead-code
  cleanup~~ — **done (2026-07-14)**. The shadcn "new-york" token system was
  entirely unused (only the never-imported `components/ui/button.tsx` referenced
  it). Removed the dead tokens (`--primary/--card/--muted/--accent/--popover/
  --destructive/--input/--chart-*/--sidebar-*`), the whole `.dark` block, and
  `button.tsx`; kept the load-bearing `--border/--ring/--background/--foreground/
  --radius` (the base layer colors ~300 bare-`border` elements). Verified
  zero visual change at the shipped-CSS level.
- ~~Fold in the trivial Next 16 `middleware` → `proxy` rename here~~ — **done
  (2026-07-14)**, verified end-to-end (locale routing + /vault auth).

**Phase 2 complete.**

## Phase 3 — UX & Design (impeccable-led)

- ~~Full design/UX **assessment via the impeccable skill**~~ — **done for the
  landing page, the Vault, and the Studio (2026-07-15)**. Landing: hero
  recomposition + editorial services. Vault: safe carousel, guest dead-end,
  mobile overlap, chapter numbering. Studio (critique snapshot:
  `.impeccable/critique/2026-07-15T13-37-50Z__app-locale-studio.md`, 18/40):
  deleted the dead `/studio/intake` stack (publicly routable, rendered a fake
  invitation for any string, could never succeed), fixed clone writing to the
  wrong wardrobe while reporting success, removed fabricated "Last Active:
  Today" from the client dashboard.
- ~~a11y sweep (roles, aria-labels, focus on icon-only buttons)~~ — **done**.
  The Studio had zero `aria-*`/`role=` across 13 components. Added
  `components/ui/Modal` + `ConfirmDialog` (dialog role, focus trap, Escape,
  focus restore), replacing five hand-rolled modals and all five native
  `confirm()` calls; item cards are buttons; tabs have tablist semantics; a
  semantic z-index scale replaced arbitrary `z-50`/`z-[100]`.
- ~~**Performance: caching / Suspense / static generation**~~ — **done
  (2026-07-15)**. The audit's "100% dynamic rendering" was literal: all 30
  routes built as `ƒ`. Two causes: next-intl was never opted into static
  rendering (no `setRequestLocale`/`generateStaticParams` — also needed in the
  legal *layout*, which renders a locale-aware `<Link>`), and `TrustedBy` read
  `cookies()` to fetch a public logo strip, opting the landing page (and via
  the shared layout, all marketing/legal pages) out of static. Added
  `app/lib/trusted-by.ts` (cookieless anon read + `unstable_cache` + tag), with
  `updateTag(TRUSTED_BY_TAG)` on admin writes for read-your-own-writes. Fixed
  the `useSearchParams`-without-Suspense bailout this surfaced in
  `/confirm`, `/login`, `/signup`. Studio pages now share the layout's cached
  `getViewer()`. **18 pages prerendered across both locales; `/vault/*`
  correctly stays dynamic.**

**Phase 3 complete.**

### Studio backlog (from the critique)

- ~~**P2 — no bulk actions**~~ — **done (2026-07-15)**. Multi-select
  (checkbox per card, shift-click range, select-all-in-filter), a bulk bar that
  replaces the filter bar while a selection is live, `bulkSetItemStatus()`
  (admin + zod, capped at 200), and grid keyboard nav (arrows/Home/End, Space
  selects, Enter opens).
- ~~**P2 — `internal_note` is write-only**~~ — **done (2026-07-15)**, and it
  was a confidentiality bug, not a naming nit: `notes` was labelled "Ale's
  Private Note" ("Notes visible only to you...") while the client view rendered
  that same column to the client. The three columns are not redundant — they
  are three audiences — so they were wired to their real meanings rather than
  consolidated: `client_note` (client's own), `notes` → "Note to Client"
  (shared, captioned as such), `internal_note` → "Private Note" (admin-only,
  service-role read/write). **Migration 08 is written but NOT applied**: apply
  after this code deploys (the old browser `select('*')` calls would fail on the
  revoked column), then run `scripts/verify_internal_note_privacy.ts` (expect
  7/7; it reports 3/7 before).
- **P3 (open)** — file inputs have no `accept`/size guard; `"Loading
  Wardrobe..."` should be a skeleton; ~11 raw `<img>` remain (mostly blob
  previews, which are legitimately raw); "Curation Ingestion" wording, and
  "client" vs "wardrobe" terminology in the empty state.

## Vault sales page — shipped (2026-09-12)

`/vault` is a public, bilingual, statically prerendered sales page for
anonymous visitors; members still land in their library. Full detail in
`docs/VAULT-LAUNCH-HANDOVER.md`.

- **Routing**: the proxy rewrites anonymous locale-prefixed `/vault` to
  `/vault-landing` (outside the member layout, so it stays SSG). The visitor's
  URL stays `/vault`; `/vault-landing` and the deleted `/vault/gallery` both 301
  to it.
- **Content is generated**: the catalogue, curriculum, runtimes and prices all
  read from the DB via a cookieless cached client. Nothing about a course is in
  JSX.
- **Migrations 09, 10, 11 applied.** 10 added `is_published` / `available_at` /
  `runtime_minutes` / `price_display`; 09 gates `video_id` behind the
  `check_access` RPC + service role; 11 records the founding cohort on offer
  purchases.
- **Pay-before-signup** works: Stripe collects the email, the webhook creates
  the account and sends a set-password link. This replaced a path that returned
  200 and silently lost the sale.
- **Analytics + SEO** built app-wide: sitemap, robots, canonical + hreflang,
  per-locale OG image, Course/FAQPage JSON-LD, one `vault_cta` event with
  section attribution.
- **Measured**: accessibility 100, best practices 100, CLS 0. SEO 69 solely
  because of the intentional `noindex`. **Performance 81, below the 90 target** —
  the cost is framer-motion in the shared `Navbar`/`TrustedByCarousel`, not this
  page. See below.

**Ships `noindex` and unlisted.** Flip with `VAULT_INDEXABLE=true` plus adding
`/vault` to `app/sitemap.ts`, once module video is real and Stripe is live.

### Next on this thread

- **Drop framer-motion from the shared chrome** — the single change that moves
  mobile performance. Ten components import it; `Navbar` and `TrustedByCarousel`
  are the two on the critical path. Touches the marketing home page, so it is a
  deliberate call.
- Gate `lab_questions` / `resource_urls` the way 09 gated the video ids, once
  the lead-magnet question is settled.
- The marketing `Hero` preloads both crops on every device (fixed on the Vault
  hero, same one-line fix).

## Phase 4 — North-star features (built on Phase 3's design language)

- Improve editorial content pull: **"Style of the Week"** + **"Ale's Pick"**,
  personalized via Essence Lab answers.
- Present it as a **carousel that funnels into the boutique**.
- Build on existing infra: `getEditorialContent` (`app/actions/dashboard.ts`),
  `essence_responses`, the boutique.

## Deferred — Ops polish (intentionally after Phase 4)

- **CSP hardening** (Report-Only → enforced): defer. It's currently decorative
  (Report-Only, no report endpoint, `unsafe-inline`), and Phases 3–4 UI churn
  would break it. Harden once, properly (nonce-based), against the stable final
  surface — a deliberate "P5 hardening."
- **Supabase CLI / Docker (WSL2)** workflow: timeboxed attempt at the Phase 4
  boundary (schema work benefits from `db diff`/`db pull`); do not rabbit-hole —
  the manual SQL + `pg_dump` workflow is proven.

## Sequencing rationale

zod (P1) yields the real types that make the `any` cleanup (P2) safer and
faster. The impeccable design pass (P3) sets the visual language the P4
editorial/carousel features live in — designing the system before building the
features, not retrofitting.
