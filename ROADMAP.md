# AC Styling — Engineering Roadmap

Status as of 2026-07-12. See `AUDIT.md` for the security audit this follows from,
and `supabase/migrations/README.md` for DB state.

## Done & deployed

**P0 (security) and P1 (hardening + robustness) are complete and in production:**
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

### Studio backlog (from the critique, not yet done)

- **P2 — no bulk actions.** Triaging a 60-item wardrobe is 60 click-wait-click
  cycles: no multi-select, no bulk status tagging, no keyboard nav between
  items. Ale is the only user of this surface and it is her daily instrument.
- **P2 — `internal_note` is write-only**: written by clone/boutique-import,
  rendered nowhere. Three overlapping note columns (`client_note`,
  `internal_note`, `notes`) want consolidating.
- **P3** — file inputs have no `accept`/size guard; `"Loading Wardrobe..."`
  should be a skeleton; 11 raw `<img>` remain (mostly blob previews, which are
  legitimately raw); "Curation Ingestion" / "client" vs "wardrobe" wording.

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
