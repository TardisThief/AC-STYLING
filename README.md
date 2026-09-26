# AC Styling

A bilingual (EN/ES) SaaS platform for a luxury personal-styling brand, built on
Next.js 16 and Supabase. Three pillars:

- **The Vault** — gated education: masterclasses, courses, the Essence Lab quiz,
  boutique, essence journal, journey tracker. Sold publicly at `/vault-access`.
- **The Studio** — wardrobe management: tokenized client intake, virtual
  wardrobe, digital lookbooks, tailor cards, client dossier.
- **The Atelier** — service discovery and booking (`/book`).

Design language is "Liquid Glass & Taupe": warm neutrals (`#5A4F44` taupe,
`#E6DED6` sand), Antic Didone headings, Inter body, glass-morphism UI.

## Requirements

- Node 22 (`.nvmrc`; `engines` in package.json pins Vercel to 22.x). Puppeteer 25 requires ≥22.12.
- A Supabase project (PostgreSQL + Auth + Storage)
- Stripe, Resend, and Vimeo accounts for payments, email, and video

## Setup

```bash
npm install
cp .env.local.example .env.local
```

`.env.local.example` lists only the two public Supabase keys. The full set of
required variables — including the server-only service-role key, Stripe keys,
and `DATABASE_URL` for `scripts/` — is documented in
[CLAUDE.md](CLAUDE.md#environment-variables). Stripe, email, and the helper
scripts will not work until those are set.

Database schema is managed directly in Supabase, not by a local CLI. See
[supabase/migrations/README.md](supabase/migrations/README.md) — those files are
**not** auto-applied, and the project is a single shared instance, so running
them hits production.

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # eslint — blocking CI gate, must be 0 errors
npm test             # vitest (watch)
npm run test:run     # vitest (once, CI)
npm run test:e2e     # playwright
```

Run `npm run lint` and `npm run test:run` before considering a change done.

## Deployment

Hosted on Vercel, deployed from `main`.

## Where things are

| Document | Covers |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Architecture, conventions, routing, server actions, access control, env vars |
| [PRODUCT.md](PRODUCT.md) | Audience, positioning, brand voice, and what may never be fabricated |
| [ROADMAP.md](ROADMAP.md) | What is done, what is next |
| [docs/VAULT-LAUNCH-HANDOVER.md](docs/VAULT-LAUNCH-HANDOVER.md) | Open items before the Vault sales page goes public |
| [docs/archive/](docs/archive/) | Completed plans, specs, and the July 2026 security audit |
