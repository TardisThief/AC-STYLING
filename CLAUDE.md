# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project

**AC Styling** — a production-grade, bilingual (EN/ES) SaaS platform for a luxury personal-styling brand. Three pillars:

- **The Vault** — gated education hub: masterclasses, chapters/courses, the Essence Lab quiz, boutique, essence journal, journey tracker.
- **The Studio** — wardrobe management: tokenized client intake, virtual wardrobe, digital lookbooks, tailor cards, client dossier.
- **The Atelier / Services** — service discovery and booking (`/book`).

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5** (strict)
- **Tailwind CSS v4** (PostCSS)
- **Supabase** — PostgreSQL + Auth + Storage (RLS on all tables)
- **Stripe** — checkout + webhooks
- **Resend** — transactional email (`lib/resend.ts`, `lib/email-templates.ts`)
- **next-intl 4** — i18n (`en`, `es`; default `en`)
- **Framer Motion**, **lucide-react**, **sonner** (toasts), **@vimeo/player** (video)
- **Puppeteer** (+ stealth) — boutique product/URL scraping (`app/actions/scraper.ts`)
- Hosted on **Vercel**

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # eslint (flat config: eslint.config.mjs) — blocking CI gate; must be 0 errors
npm test             # vitest (watch)
npm run test:run     # vitest (once, CI)
npm run test:e2e     # playwright
```

Always run `npm run lint` and `npm run test:run` before considering a change done.

## Architecture & conventions

- **Path alias**: `@/*` → repo root (e.g. `@/utils/supabase/server`).
- **Routing**: everything lives under `app/[locale]/`. Route groups: `(marketing)`, `(auth)`. App sections: `vault/`, `studio/`, `vault/admin/`, `legal/`.
- **Server Actions are the RPC layer** — mutations/data-access live in `app/actions/` (top-level per-domain files, plus `admin/` and `vault/` subfolders). Prefer adding an action over an API route. Actions dynamically `import` `@/utils/supabase/server` and start with `"use server"`.
- **API routes** are only for external callers: `app/api/webhooks/stripe/route.ts` (Stripe) and `app/api/boutique/track/route.ts` (click tracking).
- **Input validation**: action payloads are validated at the boundary with **zod**. Schemas live in `app/lib/validation/` (per-domain files; schema output keys = DB column names) — never inside `"use server"` files (Next requires their exports to be async). Pattern: `requireAdmin()`/`requireUser()` → `parseInput(schema, input)` → write **only** `parsed.data` (never spread raw client objects into inserts/upserts). Failures return one readable string in the `{ success, error }` shape that forms surface via `toast.error`. Shared primitives (`requiredText`, `optionalText`, `jsonArray`, `upsertId`, …) are in `app/lib/validation/parse.ts`. Admin `manage-*` actions are done; extend the same pattern to any new/edited action.
- **Supabase clients** (`utils/supabase/`):
  - `client.ts` — browser (anon key)
  - `server.ts` — server components / actions (anon key, cookie-aware)
  - `middleware.ts` — session refresh + route protection
  - `admin.ts` / `admin-client.ts` — **service-role key, bypasses RLS. Server-only. Never import into client code.**
- **Middleware** (`middleware.ts`) chains Supabase session refresh → next-intl. `/vault` requires auth.
- **Studio wardrobe storage**: the `studio-wardrobe` bucket is private (signed URLs via `lib/wardrobe-images.ts`). Studio components take an explicit `{ wardrobeId, ownerId }` pair (never a single ambiguous `clientId`); all uploads build their object path with `lib/wardrobe-paths.ts` — owned content under `<ownerId>/…`, ownerless guest-intake under `wardrobe/<id>/…`. The bucket policy (`public.can_access_wardrobe_object`) is owner-or-admin. File bytes never go through a server action; the browser uploads to a signed URL (see `app/actions/intake.ts`, `app/lib/upload-client.ts`).
- **Access control**: user tiers Guest → Member → Student → Super User → Admin. Admin is `profiles.role === 'admin'`. Purchase → access flow lives in `app/lib/access-logic.ts` (`grantAccessForProduct`) driven by the Stripe webhook: resolves a `stripe_product_id` against masterclasses → chapters → `STRIPE_FULL_ACCESS_PRODUCT_ID` env → `offers` (slug `full_access`/`course_pass`). Gate flags: `profiles.has_full_unlock`, `profiles.has_course_pass`, plus per-item rows in `user_access_grants`. `webhook_events` gives idempotency.
- **Components** (`components/`) grouped by domain: `vault/`, `studio/`, `admin/`, `boutique/`, `marketing/`, `monetization/`, `auth/`, `ui/`. Use `components/ui/SafeImage.tsx` for images (falls back to `FALLBACK_IMAGE_URL` in `app/lib/constants.ts`).
- **i18n**: all user-facing strings go in `messages/en.json` + `messages/es.json`. Navigation helpers from `i18n/routing.ts` (`Link`, `redirect`, `usePathname`, `useRouter`).

## Database

RLS is enabled on every table. Core tables: `profiles`, `wardrobes`, `wardrobe_items`, `tailor_cards`, `lookbooks`, `user_questions`, `admin_notifications`, `purchases`, `webhook_events`, `services`, `masterclasses`, `chapters`, `offers`, `user_access_grants`, `user_progress`, `essence_responses`, `partner_brands`, `boutique_items`, `boutique_collections`, `boutique_collection_items`, `boutique_saves`, `boutique_clicks`, `trusted_by_logos`.

Schema is managed directly in Supabase. The historical `supabase/migrations/` SQL was reset for a clean start (2026-07); add new migrations there going forward. `scripts/` holds one-off DB/QA helpers (need `DATABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY         # server-only, bypasses RLS
NEXT_PUBLIC_SITE_URL              # canonical site URL (redirects, checkout)
STRIPE_SECRET_KEY                 # Stripe API
STRIPE_WEBHOOK_SECRET             # verify webhook signatures
STRIPE_FULL_ACCESS_PRODUCT_ID     # product that grants full unlock
RESEND_API_KEY                    # transactional email
DATABASE_URL                      # direct Postgres, used by scripts/
```

`.env.local.example` only lists the two public Supabase keys — the full set above is required for Stripe/email/scripts to work.

## Testing

- **Unit** (`tests/unit/`, Vitest + Testing Library): access-control, access-logic, stripe-webhook, commerce, studio, wardrobes, dashboard, essence-lab, notifications, boutique, auth, paywall-guard, etc.
- **E2E** (`tests/e2e/`, Playwright): `smoke.spec.ts`, `intake-flow.spec.ts`.
- Shared setup in `tests/setup.ts`, helpers in `tests/utils/`.

## Notes / gotchas

- The `.agent/` directory is a generic third-party "Antigravity Kit" agent toolkit — **not** this project's architecture. Ignore `.agent/ARCHITECTURE.md` when reasoning about AC Styling.
- Design system: "Liquid Glass & Taupe" — warm neutrals (`#5A4F44` taupe, `#E6DED6` sand), Didot headings, Inter body, glass-morphism UI.
- `main` is the single working branch (local + remote) after the 2026-07 cleanup.
