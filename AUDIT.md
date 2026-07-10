# AC Styling — 360° Audit & P0 Remediation

**Date:** 2026-07-10
**Auditor:** Claude (Fable 5)
**Scope:** Full codebase (Next.js 16.1.3 App Router / React 19 / Supabase / Stripe), live Supabase schema (23 tables), RLS policies, storage-bucket policies, public-schema triggers.
**Branch:** `Dev` (isolated from `main`, which is live in production).

---

## Executive Summary

AC Styling is a feature-rich bilingual SaaS (~27k LoC, ~84 server actions, ~78 components). The foundations are better than the ~100-day hiatus suggests: TypeScript strict, the build enforces types + lint, **RLS is enabled on every table** and genuinely blocks the class of "missing role check" bugs found in the server actions, and there is a real ~15-spec unit suite.

But there are **two confirmed unauthenticated, RLS-bypassing service-role endpoints** leaking customer PII and enabling email injection, a **likely admin-self-escalation path**, **SSRF**, and misleading **mock-payment scaffolding** still wired in. **Do not resume feature work until P0 is closed.**

Security is graded **D+** — upgraded from an initial D– after the live RLS confirmed that several "missing role check" actions are backstopped by the database. The service-role endpoints are the exception: they bypass RLS entirely, so the database offers them no protection.

| Domain | Grade | Justification |
|---|---|---|
| Architecture & System Design | C | Clean App-Router monolith; 100% dynamic, no caching; authZ leans on RLS |
| Frontend & UI | C– | Works, but client-heavy, god-components, unmemoized clients, ~zero a11y |
| Backend / API / Data | C– | Consistent action pattern; no input validation, `select('*')`, unbounded lists, half-finished webhook idempotency |
| Security & Auth | D+ | Two confirmed critical service-role leaks + likely escalation; RLS mitigates the rest |
| Performance & QA | C | Good unit tests, but no CI runs them; heavy client waterfalls |
| Hiatus Hygiene | B– | Very clean of TODO cruft; dead files, mock checkout, committed test artifacts, unversioned schema |

---

## §1 Architecture — C

Server-rendered monolith; ~84 server actions in `app/actions/` are the service layer; pages are Server Components fanning out reads with `Promise.all`.

**Weaknesses:**
- AuthZ split between app checks and RLS.
- Duplicated domain logic: the guest→user profile-merge appears in `app/auth/callback/route.ts:41-90`, `app/actions/onboarding.ts`, and `app/actions/studio.ts`; the admin `role` check is copy-pasted across several `admin/` action files.
- **Scalability:** 100% dynamic rendering — no `revalidate` / `unstable_cache` / `cache()` / `<Suspense>` / `generateStaticParams` anywhere. `getUser()` + role re-fetched per layout, page, and action on the same request. Unbounded list queries (e.g. `admin/manage-clients.ts` "fetch all").

## §2 Frontend — C–

`'use client'` in ~83 files (~71%); no context providers, no state lib, no `react-hook-form`, no `zod`. God-components: `VirtualWardrobe.tsx` (~992 lines, many `useState<any[]>`), `ChapterForm.tsx` (~876). ~16 components create an unmemoized Supabase browser client in render + fetch in `useEffect`. Tailwind v4 with two competing token systems in `globals.css` (brand tokens + dead shadcn oklch) and an `!important` font hack; ~173 hardcoded hex literals. **A11y is the weakest area:** `aria-label` appears ~once, `role=` zero times across the whole UI despite pervasive icon-only buttons.

## §3 Backend / Data — C–

3 route handlers only (`api/webhooks/stripe` — signature-verified ✓, `api/boutique/track`, `auth/callback`). No input validation (`zod` unused; admin writes spread `data: any` into `insert`). `select('*')` in ~39 places. `.single()` used ~97× where `maybeSingle()` is safer. Webhook idempotency is half-finished (commented-out block; fragile 5-min purchase window); entitlement itself is sound (maps real Stripe product IDs, doesn't trust client metadata). Grants are non-idempotent (`access-logic.ts` plain `.insert`).

> **Note:** the live trigger `on_purchase_created → handle_new_purchase` (AFTER INSERT on `purchases`) is a second grant path — verify it doesn't double-grant with `grantAccessForProduct`.

## §4 Security — D+ (DB-adjusted)

### Confirmed Critical — RLS cannot help (these use the service-role client, which bypasses RLS)

| # | Severity | Finding | Evidence | DB impact |
|---|---|---|---|---|
| 1 | **Critical** | 6 exports in `notifications.ts` use `createAdminClient()` with **no auth check** → anyone calling the action dumps all customer name/email/phone + sale amounts, and can tamper notifications. | `app/actions/notifications.ts:48,129,156,193,242` (+ `archiveNotification` → `updateNotificationStatus`) | RLS "Admin full access" is bypassed by service role → **stands, Critical** |
| 2 | **Critical** | `answerQuestion` — **no auth check** (its 3 siblings have one); service-role update of any question + emails the victim with attacker-controlled answer interpolated **unescaped** into HTML. | `app/actions/send-question.ts:66-101`, `lib/email-templates.ts:100,105` | Service role bypasses RLS → **stands, Critical** |
| 3 | **Critical (confirm live)** | Admin self-escalation: `handle_new_user` may set `profiles.role` from `raw_user_meta_data->>'role'`, which is client-writable via the anon key: `supabase.auth.signUp({options:{data:{role:'admin'}}})`. App signup actions don't expose `role`, but the anon key allows direct SDK calls. | `scripts/heal_profiles.sql:42` | Live `handle_new_user` body (an `auth.users` trigger) not in the paste. **Must confirm; fix regardless.** |

### Confirmed High

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 4 | **High** | Unauthenticated SSRF: `extractUrlMetadata(url)` runs `puppeteer.goto(url)` (`--no-sandbox`), **no auth**. Called from admin UI but reachable as a raw server action (public POST). | `app/actions/scraper.ts:3-23` |
| 5 | **High** | Authenticated SSRF + arbitrary target path: `uploadRemoteImage(imageUrl, userId)` fetches a client URL and writes the bytes under a **client-supplied** `userId` into a public bucket → read internal endpoints back via the public URL. | `app/actions/studio.ts:200-236` |

### Medium (some downgraded by RLS, some newly surfaced by the DB)

| # | Severity | Finding | DB impact |
|---|---|---|---|
| 6 | **Med (new)** | `partner_brands` RLS "Public view brands" (SELECT→public) exposes `internal_notes`, `commission_rate`, `contact_email` to anyone. | Surfaced by live RLS. Real data exposure. |
| 7 | **Med→High (new)** | `studio-wardrobe` bucket: "Public Upload Access" (INSERT→anon) + "Public Read Access" (SELECT→public) → personal wardrobe photos world-readable and anyone can upload arbitrary files. | Confirmed from bucket policies. |
| 8 | **Med** | Open redirect: `NextResponse.redirect(\`${baseUrl}${next}\`)`, `next` from query/cookie, no same-origin check. Also `login/page.tsx`, `confirm/page.tsx`. Magic-link URLs `console.log`'d. | `app/auth/callback/route.ts:125`, `app/actions/auth.ts:173` |
| 9 | **Med** | No rate limiting / CAPTCHA on email actions (magic-link/reset/signup) → mail-bombing, Resend cost abuse, enumeration. No security headers in `next.config.mjs` (no CSP/HSTS/X-Frame-Options). | `app/actions/auth.ts`, `next.config.mjs` |

### Downgraded by live RLS (now defense-in-depth / low, not live breaches)

| # | Was | Now | Why |
|---|---|---|---|
| 10 | Fake-purchase forgery (`purchaseProduct`) | **Low** | `purchases` has no user INSERT policy → the insert is DB-denied for normal users. Still misleading mock scaffolding to remove; latent if an INSERT policy is ever added. |
| 11 | `manage-clients` IDOR / profile enumeration | **Low** | `profiles` + `essence_responses` RLS restrict non-admins to their own rows. Missing role check is hygiene, not a breach. |
| 12 | `manage-boutique` writes without role check | **Low** | "Admins manage" RLS (ALL) blocks non-admin writes. Add the code check for defense-in-depth. |

### Done right

Stripe signature verification; middleware uses `getUser()` not `getSession()`; admin pages gated server-side (`vault/admin/layout.tsx`); no hardcoded secrets, no tracked `.env*`; service-role key never in a `'use client'` file; no raw SQL from user input; the one `dangerouslySetInnerHTML` renders a static constant; **RLS enabled on all 23 tables** and effective for the anon/user client.

**Root cause:** every confirmed critical is one mistake — a `'use server'` function that is a public POST endpoint but assumes it's only called from the trusted admin UI, and/or uses the service-role client without re-checking the caller.

## §5 Performance & QA — C

~15 Vitest unit specs (real business logic) + 2 Playwright e2e + a Supabase mock. But **no CI** (`.github/` absent), no Prettier/husky. Committed test-failure artifacts (`test-results/`, `playwright-report/`). Perf costs are architectural (§1).

## §6 Hiatus Hygiene — B–

Exactly one real TODO (`studio.ts`). Dead `components/vault/EditorialDraft.tsx` (0 imports); stray `lib/email-templates.ts.tmp`; empty/dup `schema_dump*.sql`. Schema/RLS/triggers are unversioned (deleted in the 2026-07 cleanup) — now recoverable since the live definitions are available; re-versioning is P1. Stack is recent; `puppeteer-extra-plugin-stealth` shipped as a prod dep is the one to watch (`npm audit` is a P1 step). Clean single-branch git.

---

## Remediation Plan

### P0 — this pass (Dev branch)

**Code (safe on Dev; no prod impact until deployed):**

1. `app/lib/auth-guards.ts` — `requireUser()` / `requireAdmin()` returning a typed result matching the `{success,error}` convention. Reusable mechanism so authZ can't be forgotten again.
2. `notifications.ts` — gate all 6 exports with `requireAdmin()`. (#1)
3. `send-question.ts` — gate `answerQuestion` with `requireAdmin()`; HTML-escape interpolated question/answer in `email-templates.ts`. (#2)
4. `scraper.ts` — `requireAdmin()` + block private/link-local IPs and non-http(s) schemes before `page.goto`. (#4)
5. `studio.ts uploadRemoteImage` — derive target user from session (admin may pass explicit `userId` only after `requireAdmin()`); same SSRF host/IP guard. (#5)
6. `auth/callback/route.ts` + `login/page.tsx` + `confirm/page.tsx` — validate `next` is a same-origin relative path; strip token `console.log`s. (#8)
7. Remove mock checkout: delete `app/[locale]/vault/checkout/[productId]/page.tsx` + `commerce.purchaseProduct`; remove references. (#10)
8. Defense-in-depth `requireAdmin()` in `admin/manage-clients.ts` and `admin/manage-boutique.ts` mutations. (#11, #12)
9. `next.config.mjs` — `headers()` block (CSP report-only, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`).

**Database (written as reviewable SQL under `supabase/migrations/`; applied by the user, not by the agent):**

- `harden_handle_new_user.sql` — `role` always `'user'`, never from `raw_user_meta_data`. Safe to apply even if the current body already does this. (#3)
- `restrict_partner_brands_read.sql` — public SELECT sees display columns only; admins see all. (#6)
- `lock_studio_wardrobe_bucket.sql` — remove anon INSERT + public SELECT; require authenticated owner/admin; reads via signed URLs. (#7) *(Bucket→private also needs signed-URL code — that code is P1, so this migration is staged/coordinated.)*

### P1 — next

~~Signed-URL bucket code~~ (done: `lib/wardrobe-images.ts` + migration 03); ~~rate limiting on email actions~~ (done: `app/lib/rate-limit.ts` + migration 04; CAPTCHA deferred); ~~CI (GitHub Actions running test:run)~~ (done: `.github/workflows/ci.yml`; lint is informational until the `no-explicit-any` backlog is cleared); ~~fix the 3 pre-existing broken test files~~ (done: suite is green, 154 tests); ~~webhook idempotency finalization~~ (done: event-`id` gate + `stripe_processed_events` migration 05; the fragile 5-min purchase window removed) + ~~verify the `handle_new_purchase` trigger doesn't double-grant~~ (verified: no double-grant — the trigger grants *studio* access for service purchases and is idempotent, complementary to `grantAccessForProduct`'s content grants); `npm audit` / `npm outdated`; re-version the full schema/RLS/triggers under `supabase/migrations/`; remove committed test artifacts.

### P2 — roadmap

`zod` input validation; de-duplicate profile-merge + admin-check logic; caching / `<Suspense>` / static generation where safe; a11y sweep (roles, aria-labels, focus); dead-code cleanup; consolidate the two Tailwind token systems.

**Normalize the wardrobe storage folder convention.** The `clientId` prop is a client `user.id` in some entry points ([my-studio](app/[locale]/vault/my-studio/page.tsx)) but a `wardrobe_id` in the stylist dashboard ([StudioDashboard.tsx](components/studio/StudioDashboard.tsx)); files are uploaded under `${clientId}/`, so the folder is inconsistently a user id or a wardrobe UUID (and `VirtualWardrobe` even inserts `user_id: clientId`). Because of this, migration 03 uses an authenticated-only storage policy rather than a strict per-owner one. Once the convention always uses the client's `user_id`, tighten the `studio-wardrobe` policy to owner-or-admin (SQL stub is in the migration file).

### Scope guardrails

Only P0 this pass. No push to `main`, no merge, no applying SQL to the live DB, no deploy — all left to the user.
