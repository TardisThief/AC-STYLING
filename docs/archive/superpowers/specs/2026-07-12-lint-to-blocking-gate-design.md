# Lint-to-Blocking Gate — Design

**Date:** 2026-07-12
**Status:** Approved (pending user spec review)
**Roadmap:** P2 — `no-explicit-any` cleanup → flip CI lint from informational to a blocking gate
**Branch:** Dev (single branch, one PR)

## Problem

CI's lint step runs with `continue-on-error: true` (`.github/workflows/ci.yml:33`)
because a full-tree `npm run lint` reports **1,531 errors**. That count was the
basis for the roadmap's "~1500 no-explicit-any" estimate. Measured accurately,
the picture is very different.

### Actual error distribution (measured 2026-07-12)

| Location | Errors | of which `no-explicit-any` | Tracked in git? |
|---|---|---|---|
| `claude-mem/` | 1,196 | 470 | **No** (gitignored) |
| `superpowers/` | 43 | — | **No** (gitignored) |
| `impeccable/` | 9 | — | **No** (gitignored) |
| `components/` | 143 | 88 | Yes |
| `app/` | 101 | 33 | Yes |
| `tests/` | 34 | 33 | Yes |
| `utils/` + `scripts/` | 5 | 4 | Yes |
| **Total** | **1,531** | **628** | |

**1,248 of the 1,531 errors are in gitignored, zero-tracked-file tooling
directories** that ESLint lints only because flat config does not read
`.gitignore` automatically. They are not our code. The real tracked-app-source
problem is **~283 errors**, ~158 of them `no-explicit-any`.

To make lint a blocking gate, **all** error-level rules must reach zero on
tracked source — not just `any`. So the scope is "eliminate every tracked
app-source error," of which the `any` work is the majority.

Warnings (9,432, mostly `@next/next/no-img-element` and unused vars) stay
non-blocking; ESLint does not fail on warnings, and reducing them is a separate
future effort explicitly out of scope here.

## Decisions (from brainstorming)

- **Ignore gitignored tooling dirs** via `includeIgnoreFile` from `@eslint/compat`
  (respects `.gitignore` automatically; self-maintaining) rather than a
  hand-maintained ignore list.
- **Relax `no-explicit-any` for `tests/**`** via an ESLint override — test mocks
  legitimately use `any`; this drops 33 low-value fixes and keeps the gate on
  shipping code.
- **One branch / one PR.** Surface any behavior-risky fix rather than forcing it.

## Stages

### Stage 1 — Config (eliminates ~1,281 errors, no code changes)

1. `npm install -D @eslint/compat` (not currently installed).
2. In `eslint.config.mjs`: `includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url)))`
   added to the config array → ESLint stops linting `claude-mem/`,
   `superpowers/`, `impeccable/` (−1,248).
3. Add a `tests/**` override: `{ files: ['tests/**'], rules: { '@typescript-eslint/no-explicit-any': 'off' } }` (−33).

**Verify:** `npm run lint` error count drops from 1,531 to **~249**, all in
tracked app source (`components/`, `app/`, `utils/`, `scripts/`).

### Stage 2 — Mechanical / autofixable (~120 errors)

Batched by rule, one commit each, `npm run test:run` after each:

- `eslint --fix` for `prefer-const` (11) and any other auto-resolvable rules.
- `react/no-unescaped-entities` (67): replace bare `'` / `"` in JSX text with
  entities (`&apos;` / `&quot;`) or `{'…'}`.
- `@next/next/no-html-link-for-pages` (42): swap internal `<a href="/…">` for the
  **i18n `Link` from `@/i18n/routing`** (this project is locale-routed — raw
  `next/link` would bypass locale prefixing). Each occurrence eyeballed to
  confirm it is internal navigation, not an external or in-page anchor.

### Stage 3 — `no-explicit-any` cleanup (~125, the bulk)

Typing philosophy, in priority order:

1. **Proper types** where the shape is known — especially Supabase rows. Many
   `any`s are `useState<any[]>` for DB records. Introduce shared row types
   (informed by the existing zod schemas in `app/lib/validation/`) rather than
   hand-typing each call site.
2. **`unknown` + narrowing** for genuinely dynamic data (scraper output, JSON).
3. **`eslint-disable-next-line @typescript-eslint/no-explicit-any` with a
   reason comment** only for true third-party escape hatches.

Sequenced by directory for reviewable commits: `app/actions/**` → `app/**`
pages → `components/` by domain (`admin/`, `studio/`, `vault/`, `boutique/`,
top-level). The 223-test suite guards behavior throughout.

### Stage 4 — React-hooks correctness (~9, reviewed individually)

Not bulk-fixed — these touch render logic:

- `react-hooks/rules-of-hooks` in `components/auth/InteractiveGate.tsx:45` — a
  conditionally-called hook, a **genuine latent bug**. Fix carefully; add a test
  if feasible.
- 6× `react-hooks/set-state-in-effect` (`app/[locale]/vault/join/page.tsx`,
  `components/UserNotifications.tsx`, `components/admin/AdminDashboard.tsx`,
  `components/admin/BoutiqueManager.tsx`, `components/admin/TrustedByManager.tsx`,
  `components/studio/ArchiveManager.tsx`) — usually benign initialization
  patterns; fix (guard, move to event handler, or lazy initializer) or justify
  per case.
- Any residual `react-hooks/*` (immutability, refs, static-components) in tracked
  source resolved case-by-case.

**If any fix is behavior-risky, stop and surface it** rather than forcing the
gate.

### Stage 5 — Flip CI to blocking

- `.github/workflows/ci.yml`: remove `continue-on-error: true` from the lint
  step (line 33) and update the comment block (lines 27–31) to state lint is now
  enforced. Rename the step from "Lint (informational)" to "Lint".
- Errors fail the build; warnings do not (no `--max-warnings`).
- One-line update to `ROADMAP.md` (P2 item) and `CLAUDE.md` (Commands section:
  `npm run lint` is now a required gate).

## Verification

- `npm run test:run` green after every stage (223 tests, unchanged behavior).
- `npm run lint` exits **0** at the end.
- `npm run build` exits 0.
- Final sanity: re-run the by-directory error analysis to confirm zero tracked
  app-source errors remain.

## Non-goals

- The 9,432 warnings (`no-img-element`, unused vars, etc.) — separate effort.
- Retyping test-file `any`s (rule relaxed for `tests/**`).
- Any behavior change; this is a types-and-config pass. React-hooks fixes that
  would change behavior get surfaced, not silently applied.
