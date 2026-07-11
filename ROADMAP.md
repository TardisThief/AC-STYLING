# AC Styling — Engineering Roadmap

Status as of 2026-07-10. See `AUDIT.md` for the security audit this follows from,
and `supabase/migrations/README.md` for DB state.

## Done & deployed

**P0 (security) and P1 (hardening) are complete and in production:**
auth guards, service-role leak fixes, SSRF guards, open-redirect fix, security
headers, mock-checkout removal; DB migrations 01–05 applied (handle_new_user
hardening, partner_brands column grants, studio-wardrobe lockdown, email
`rate_limits`, `stripe_processed_events`); partner_brands public/admin read
split; signed-URL wardrobe images; email rate limiting; Stripe webhook
idempotency; CI (`.github/workflows/ci.yml`) with a green 161-test suite; npm
audit 20→2; schema baseline (`supabase/migrations/00000000000000_baseline.sql`);
Next 16 `serverActions.bodySizeLimit` upload fix.

## Phase 1 — Robustness & Correctness (current)

- **zod input validation** on server actions, starting with admin writes that
  spread `data: any` into inserts with no validation.
- **Wardrobe storage folder normalization** — resolve the `clientId` = user_id
  vs wardrobe_id inconsistency (and the latent `user_id: clientId` bug in
  `VirtualWardrobe`), then tighten migration 03's storage RLS from
  authenticated-only to strict per-owner.

## Phase 2 — Code Health & Dev Velocity

- `no-explicit-any` cleanup (~1500 errors) → flip CI's lint step from
  informational (`continue-on-error`) to a blocking gate.
- De-duplicate the profile-merge logic + remaining inline admin checks.
- Tailwind token consolidation (brand tokens vs. dead shadcn oklch); dead-code
  cleanup.
- Fold in the trivial Next 16 `middleware` → `proxy` rename here.

## Phase 3 — UX & Design (impeccable-led)

- Full design/UX **assessment via the impeccable skill** — propose upgrades
  beyond current scope, not just fixes.
- a11y sweep (roles, aria-labels, focus on icon-only buttons).
- Performance: caching / Suspense / static generation (audit flagged 100%
  dynamic rendering + per-request `getUser` refetches).

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
