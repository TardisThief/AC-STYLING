# AC Styling — Engineering Roadmap

Status as of 2026-09-19. See
[docs/archive/AUDIT-2026-07-10.md](docs/archive/AUDIT-2026-07-10.md) for the
historical security audit this follows from, and
[supabase/migrations/README.md](supabase/migrations/README.md) for DB state.

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
| Immediate | F01–F04: profile privileges, RPC execution, boutique/storage policies | Deploy coordinated server actions BEFORE migration 12; agent applies SQL; verify roles and upload behavior in production | **Deployed, applied, and verified.** Release `87dea9e`; migration 12 committed 2026-09-20 03:53 UTC (September 19 EDT). All 13 structural and 33 live smoke checks pass; fixtures removed. Agent migration authority is now documented. |
| Immediate | F08: patched Next.js | Align Next and eslint-config-next; verify Node/React requirements; lint, tests, typecheck, production build | **Next.js 16.3.5 deployed** in release `87dea9e`; CI, tests, lint, TypeScript and build pass. Four Puppeteer/extract-zip high findings remain; no forced downgrade. |
| Before payments | F05–F07: fulfillment, claim lifecycle, SSRF | Requires protected entitlements; durable replay-safe grants; all password-setting paths; safe remote-image delivery | Queued after authorization dependencies |
| Before promotion | F09/F14: real content/live payments and deployed behavior | Alejandra's videos, owner-managed Stripe/Vimeo, deployment verification; preserve noindex until complete | Open; see Vault handover |
| Release assurance | F10–F13: token boundaries, deletion, restoration, integration tests | Role tests and purchase model first; retention decision before deletion changes | F13 partially implemented: 31 isolated PostgreSQL authorization tests now included in CI. F10–F12 remain open, including restoration's 100-session limit. |
| Stabilization | F15–F16: localization, performance, recovery/operations | Translation coordination; measured performance; recoverable schema/storage and alerts | Open; translations handled separately |

Progress entries distinguish **implemented**, **validated locally**, **applied to
DB**, **deployed**, and **verified in production**. A passing unit test or a SQL
file alone does not close a live finding. Update this table at each milestone.

**2026-09-19 production checkpoint:**
[release dependencies, sequence, and smoke checks](docs/RELEASE-2026-09-19-AUTHORIZATION.md)
and the [sanitized verification record](docs/AUTHORIZATION-VERIFICATION-2026-09-19.json)
record the completed rollout. Full suite: **38 files / 320 tests passed**; lint:
**0 errors / 159 existing warnings locally, 160 on the production-based release**.
Production build, TypeScript and GitHub CI pass. The live verifier now passes
all 13 checks; all 33 production smoke checks pass. Customer records/files were
preserved and temporary verification fixtures removed. The release excludes the
five previously unpushed commits and unfinished translation work. Next work is
F05–F07; fulfillment must also reconcile the live trigger's price-ID/product-ID
mismatch and propagate failed grants. Translation/legal files remain with the
other agent.

## Done & deployed

**Historical July P0/P1 work recorded as complete and in production** (new
September findings are tracked above):
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
  `docs/archive/superpowers/{specs,plans}/2026-07-11-wardrobe-storage-normalization*`.
  Remaining optional cleanup: `scripts/cleanup_orphaned_wardrobe_files.ts` (44
  orphaned files, dry-run first).

## Phase 2 — Code Health & Dev Velocity

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
  `docs/archive/superpowers/{specs,plans}/2026-07-12-lint-to-blocking-gate*`.
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
  mobile overlap, chapter numbering. Studio (critique scored 18/40; the snapshot
  file was removed in the 2026-09 cleanup — findings are summarised here and in
  the Studio backlog below):
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
  service-role read/write). **Migration 08 is applied** — verified against prod
  2026-09-14: `internal_note` carries no SELECT/UPDATE/INSERT grant for `anon`
  or `authenticated`, `select('*')` is refused for both, and the client's own
  columns, note edits and deletes still work. 7/7 (it reports 3/7 before apply);
  re-check any time with `scripts/verify_internal_note_privacy.ts`.
- **P3 (open)** — file inputs have no `accept`/size guard; `"Loading
  Wardrobe..."` should be a skeleton; ~11 raw `<img>` remain (mostly blob
  previews, which are legitimately raw); "Curation Ingestion" wording, and
  "client" vs "wardrobe" terminology in the empty state.

## Vault sales page — shipped (2026-09-12)

The public, bilingual, statically prerendered sales page lives at
`/vault-access`; `/vault` stays the members-only library and redirects anonymous
visitors. The catalogue, curriculum, runtimes and prices are all generated from
the database. Migrations 09, 10, 11 applied. Pay-before-signup works. Measured
accessibility 100, best practices 100, CLS 0, performance 81.

It ships `noindex` and unlisted until module video is real and Stripe is live.

**Full detail, the open items, and the flip procedure are in
[docs/VAULT-LAUNCH-HANDOVER.md](docs/VAULT-LAUNCH-HANDOVER.md)** — that is the
single source for this thread; do not duplicate its state here.

### Next on this thread

- **Drop framer-motion from the shared chrome** — the single change that moves
  mobile performance. Ten components import it; `Navbar` and `TrustedByCarousel`
  are the two on the critical path. Touches the marketing home page, so it is a
  deliberate call.
- Gate `lab_questions` / `resource_urls` the way 09 gated the video ids, once
  the lead-magnet question is settled.
- The marketing `Hero` preloads both crops on every device (fixed on the Vault
  hero, same one-line fix).

## Phase 3.5 — Launch readiness: SEO, legal, a11y (current)

Opened 2026-09-19 from an audit of the codebase against four widely-circulated
"things to add before launching" checklists (SEO, legal/compliance, performance,
pre-launch). ~80 listed items collapsed to the 10 below: most of the rest were
already shipped (`app/lib/seo.ts`, `robots.ts`, `sitemap.ts`, `not-found.tsx`,
the legal pages, account deletion, cookieless first-party analytics) or are
Vercel/Next defaults (HTTPS, CDN, minification, code splitting, image
compression, connection pooling).

The through-line: **`/vault-access` is the only page on the site that is
launch-ready.** It has metadata, canonical, hreflang, an OG image, an `<h1>`,
FAQ copy and `Course` + `FAQPage` JSON-LD. The other 29 routes have none of it.
Most of this phase is propagating patterns that already exist in the repo
rather than inventing anything.

Order below is the agreed execution order. 1–2 unblock launch; 3–4 are the only
genuine legal exposure. **1–5 are done; 6 is next.**

- ~~**1. Roll `buildMetadata` out site-wide.**~~ — **done (2026-09-19)**. Added
  `pageMetadata()` to `app/lib/seo.ts`, which reduces a route to one line and
  reads its copy from the new `Meta` namespace in `messages/{en,es}.json` (27
  keys, both locales at parity). All 30 routes now carry a unique title and
  description; public routes also get canonical + `hreflang` (`en`/`es`/
  `x-default`) + OG/Twitter, and gated routes get `noindex, nofollow` and
  deliberately **no** canonical — a noindex page has nothing to be canonical
  about, and pointing one at a parent would be a wrong signal. Six pages were
  client components and so could never export `generateMetadata`; each was split
  into a server wrapper plus a colocated `*Client.tsx` (the five `(auth)` routes
  and `vault/join` — the last one found by the build, not by grep, because it
  writes `'use client'` in single quotes). Verified in the emitted HTML, not just
  the build log. Prerendering did not regress: 20 pages still SSG.
- ~~**2. Give `/book` a document.**~~ — **done (2026-09-19)**. Was a bare Calendly
  iframe: no `<h1>`, no copy, no metadata, and an unused
  `useTranslations('Services')`. Now a server component with an `h1`, a
  three-step "what happens in the call" list, a four-question FAQ in a `dl`, and
  labelled sections — 281 visible words, up from effectively zero. The scheduler
  is isolated in `CalendlyEmbed.tsx` as the page's only client component, moved
  to `strategy="lazyOnload"`, and given a `<noscript>` direct link so the booking
  path survives the widget being blocked. Still prerendered in both locales.
  Remaining: the FAQ copy is ready to carry `FAQPage` JSON-LD, which is folded
  into item 7.
- ~~**3. Reconcile the cookie/tracking story.**~~ — **done (2026-09-19)**.
  Section 5 of `legal/privacy` was rewritten against what the code actually
  does: strictly necessary Supabase auth cookies, cookieless first-party Vercel
  Analytics, Calendly as the one cookie-setting third party, Stripe's own
  cookies on its hosted checkout, and an explicit statement that we run no
  Google Analytics, no pixels, no retargeting and no abandoned-cart tracking —
  so there is no advertising opt-out to offer because there is nothing to opt
  out of. Section 4 now names the six real processors (Supabase, Stripe, Resend,
  Vercel, Calendly, Google) instead of a generic list.

  The gate is **in-place on `/book`, not a site-wide banner**, because Calendly
  is the only cookie-setting third party on the site and a banner on every page
  would be asking about something that exists on one. `CalendlyEmbed.tsx` now
  renders a placeholder until the visitor loads it: verified in the prerendered
  HTML that `assets.calendly.com` and the widget container are both absent
  before consent, leaving only a plain `<a href>` that makes no request until
  clicked. The choice is remembered per-device via `localStorage`, read through
  `useSyncExternalStore` (a server snapshot keeps hydration honest and it picks
  up cross-tab changes) rather than an effect — the first attempt used an
  effect and the blocking lint gate correctly rejected the setState cascade.
  A `<noscript>` direct link keeps the booking path alive with scripting off,
  since the consent button cannot work there.

  **Scope note:** fixing only the cookie claims would have left the same class
  of defect untouched elsewhere in the same file, so three adjacent unsupported
  claims went too — a third-party advertising "Offer Wall" we do not have, an
  "AI Products … including Google Cloud AI" section (the Essence Lab is fixed
  rules, not a model), and Facebook/X social logins we do not offer (Google is
  the only provider). The policy's "Last updated" date moved to 2026-09-19.
- ~~**4. Translate the legal pages.**~~ — **done (2026-09-20)**. All three
  documents now exist in both locales: a Spanish visitor gets Spanish terms.

  The text lives in per-locale server components (`PrivacyEn/Es.tsx`,
  `TermsEn/Es.tsx`, `RefundsEn/Es.tsx`) with `page.tsx` choosing between them,
  **not** in `messages/*.json`. These are long-form documents whose structure —
  headings, lists, inline links, anchor ids — is part of the text, and
  threading ~9,000 words of it through message keys would make both the copy
  and the markup harder to review than the prose is to read. Section anchors
  are deliberately identical across locales (`#cookies`, `#refunds`, …): an
  anchor is an address, not copy, so a link to a clause resolves in either
  language. Verified: 15 ids in privacy and 27 in terms match one-for-one
  between EN and ES, with no dangling links.

  **Terms was converted from a Termly HTML blob to real JSX.** It had been
  injected with `dangerouslySetInnerHTML` carrying its own inline `<style>`
  block forcing Arial and `#000`, which made it the one page on the site that
  did not look like the site. The words are unchanged; the markup and the
  `<style>` block are gone, and it now inherits the shared prose/Didot styling.

  **Two false sections were removed from terms and three claims from privacy**
  (agreed scope, same defect class as item 3's Offer Wall): the mobile
  application licence and the SMS text-messaging section (there is no app and
  we send no SMS), plus privacy's health-data/biometric-data processing, its
  mobile-device-access and push-notification permissions, and the
  "download our mobile application" bullet. Privacy's sensitive-information
  answer is now a plain "No." Terms renumbered 1–27; nothing cross-references a
  section by number, only by name, so the renumbering was safe. The disclaimer's
  references to *third-party* mobile applications are legitimate and kept in
  both locales.

  A bug the lint gate caught: the new cross-link from terms to the privacy
  notice was a bare `<a href="/legal/privacy">`, which drops the locale — a
  Spanish reader would have landed on the English notice. Now the i18n `Link`;
  verified in the emitted HTML that `/es/legal/terms` links to
  `/es/legal/privacy`. All six pages still prerender; lint 0 errors; 320 tests
  green.

  **Not verified by me:** the Spanish is my translation, not a lawyer's. These
  are terms that bind customers, so Ale or counsel should read the Spanish
  before launch. The English remains the authoritative text and the two must be
  changed together — a divergence between them is a legal defect, not a nit.
- ~~**5. Add `error.tsx` / `global-error.tsx`.**~~ — **done (2026-09-20)**.
  There was no error boundary anywhere in `app/`, so any render error dropped
  the user on Next's default screen. Three now exist:

  - `app/global-error.tsx` — catches failures of the root layout itself, so it
    replaces that layout and supplies its own `<html>`/`<body>`. Deliberately
    self-contained: inline styles, system fonts, **zero imports**, no
    translations. If it renders, the root layout did not, which means the
    next-intl provider, the Google fonts and the Tailwind layer are all
    candidates for what broke. A pretty error page that itself throws is worse
    than a plain one that does not. English-only for the same reason — the
    provider lives below the layout that just failed.
  - `app/[locale]/error.tsx` — the localized boundary for everything under a
    locale, with retry, a link home, and the error digest (the only handle
    support has on a production failure, since the message itself is withheld).
  - `app/[locale]/vault/error.tsx` — Vault-scoped, so a failing Vault page
    keeps `vault/layout.tsx` and the concierge navbar mounted. Without it the
    error replaces the whole screen and reads as "the Vault is gone" rather
    than "this page did not load"; the copy states what is actually true, that
    progress and purchases are untouched, because a render error never wrote
    anything.

  **Verified at runtime**, not just compiled: a temporary throwing route under
  each locale returned HTTP 500 with the boundary rendered and correctly
  localized (`/en/boom` English, `/es/boom` Spanish), retry button and digest
  present. The throwing routes were removed afterwards. Note they had to be
  `force-dynamic` to test at all — a page that throws during prerender fails
  the build instead.

  **Not runtime-verified:** the Vault boundary, because `/vault` redirects
  anonymous requests at the proxy and this check had no session; it compiles,
  lints and is structurally identical to the locale boundary that is proven to
  work. `global-error.tsx` likewise, since triggering it means breaking the
  root layout.

  **A localized 404 was attempted and abandoned — this is a real finding.**
  On Next 16.3.5 with next-intl, `notFound()` renders the root
  `app/not-found.tsx` no matter where a nested `not-found.tsx` sits. Tried, and
  each time inspected the streamed RSC payload: `app/[locale]/not-found.tsx`
  with next-intl's documented `[locale]/[...rest]` catch-all; the catch-all
  alone (a probe marker confirmed the route *does* execute); a `not-found.tsx`
  colocated inside `[...rest]`; and removing the root `not-found.tsx` entirely
  (which fell through to Next's built-in default, not the locale one). In every
  case the nested file appeared only in the `notFound` **slot** — registered,
  never rendered. So a Spanish visitor still gets an English 404. The branded
  root 404 is unaffected and still works. A workable follow-up, if wanted:
  make the root `not-found.tsx` read next-intl's `NEXT_LOCALE` cookie via
  `headers()` and pick its own strings — it is outside `[locale]` so it has no
  `params`, but it can read cookies. Not done, because it is beyond this item
  and costs the 404 its static rendering.
- **6. Alt-text sweep.** Confirmed missing on raw `<img>` in
  `components/admin/BoutiqueManager.tsx` and `components/admin/CollectionsManager.tsx`
  (2 instances). Plus ~16 `alt=""` to triage — decorative is a legitimate answer,
  unlabelled content is not. Pairs with the open Studio P3 "~11 raw `<img>`" item.
- **7. `Organization` schema on the home page.** The site's only JSON-LD is on
  `/vault-access`. The brand entity belongs on the root.
- **8. Breadcrumbs in the Vault.** `vault/courses/[slug]/essence-lab` is four
  levels deep with no positional affordance. The routes are gated so there is no
  SEO argument here — this is purely the UX one, which is why it sits below 1–7.
- **9. Loading skeletons beyond marketing.** `(marketing)/loading.tsx` is the only
  one in the app, and the Vault pages are the slow ones. Subsumes the open Studio
  P3 item (`"Loading Wardrobe..."` should be a skeleton).
- **10. Email footers.** All four templates in `lib/email-templates.ts` are
  transactional, so no unsubscribe link is strictly required — but none carries a
  physical business address, which CAN-SPAM does require of anything promotional.
  `getPurchaseWelcomeHtml` is the borderline one. Decide its character, then give
  it the right footer. The address to use is already in the legal terms:
  AC Styling, 1865 S Ocean Dr, Hallandale Beach, FL 33009, United States.

### Considered and rejected

- **`llms.txt`** — unratified, honored by no crawler.
- **"Remove noindex tags"** — ours is deliberate and documented; it lifts with
  `VAULT_INDEXABLE` per the handover, not as a checklist item.
- **Maps, directions, `LocalBusiness` schema** — a service brand with no
  storefront. Revisit only if in-person clients are seen at a fixed address.
- **Thank-you page** — `/welcome` already is one.
- **Load balancer, CDN, HTTPS, minification, image compression** — Vercel.
- **Sticky mobile CTA** — deliberately not, pending the framer-motion decision on
  the shared chrome; it would add to the critical path this repo is trying to cut.

One-off worth doing alongside: confirm the `Testimonials` entries are real and
attributable. Unverifiable testimonials are the checklist item that actually
draws FTC complaints.

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
features, not retrofitting. Phase 3.5 sits between them because it is launch
gating, not feature work: shipping P4 editorial surfaces onto pages that carry
no metadata and a privacy policy describing tracking we do not run would mean
doing 3.5 twice.
