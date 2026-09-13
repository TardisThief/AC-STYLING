# Lint-to-Blocking Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run lint` exits 0 on tracked app source, and CI's lint step becomes a blocking gate.

**Architecture:** First scope ESLint to stop linting gitignored tooling dirs and relax `any` for tests (config-only, eliminates ~1,281 of 1,531 errors). Then fix the ~250 real app-source errors rule-class by rule-class. Finally remove `continue-on-error` from CI. No behavior changes — the 223-test suite guards throughout; behavior-risky react-hooks fixes get surfaced, not forced.

**Tech Stack:** ESLint 9.39 flat config (`eslint.config.mjs`), `@eslint/compat`, Next.js 16 i18n routing (`@/i18n/routing`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-lint-to-blocking-gate-design.md`

## Global Constraints

- Branch: **Dev**. One PR. Never merge/deploy — the user does that.
- Zero behavior change. `npm run test:run` (223 tests) stays green after every task.
- Only error-level rules must reach zero. Warnings (9,432, mostly `no-img-element`) stay non-blocking — do NOT add `--max-warnings`.
- `no-explicit-any` is relaxed for `tests/**` (Task 1); do not retype test mocks.
- Internal navigation uses `Link` from `@/i18n/routing` (locale-routed), never raw `next/link`.
- If a react-hooks fix would change runtime behavior, STOP and surface it.
- Count a rule's remaining errors with: `npm run lint 2>&1 | grep -c "<rule-id>"`.

---

### Task 1: Scope ESLint (config only — drops ~1,281 errors)

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `package.json` (devDependency)

**Interfaces:**
- Produces: an ESLint config that ignores everything in `.gitignore` and disables `@typescript-eslint/no-explicit-any` under `tests/**`.

- [ ] **Step 1: Install @eslint/compat**

Run: `npm install -D @eslint/compat`
Expected: added to devDependencies; `npm ci` reproducible.

- [ ] **Step 2: Rewrite eslint.config.mjs**

```js
import { defineConfig, globalIgnores } from "eslint/config";
import { includeIgnoreFile } from "@eslint/compat";
import { fileURLToPath } from "node:url";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

const eslintConfig = defineConfig([
  // Respect .gitignore (skips claude-mem/, superpowers/, impeccable/, etc.)
  includeIgnoreFile(gitignorePath),
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Test mocks legitimately use `any`; keep the gate on shipping code.
    files: ["tests/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);

export default eslintConfig;
```

- [ ] **Step 3: Verify the error count collapses**

Run: `npm run lint 2>&1 | tail -3`
Expected: from ~1,531 errors to **~250 errors** (all under `app/`, `components/`, `utils/`, `scripts/`). Confirm no `claude-mem/`/`superpowers/`/`impeccable/` paths appear:
Run: `npm run lint 2>&1 | grep -cE "claude-mem|superpowers|impeccable"` → `0`

- [ ] **Step 4: Verify tests still pass**

Run: `npm run test:run`
Expected: 223 passed.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json
git commit -m "P2: scope ESLint to .gitignore + relax any for tests (1531->~250 errors)"
```

---

### Task 2: Trivial mechanical rules (prefer-const, require-imports, unsafe-function-type)

**Files:**
- Modify: `app/actions/send-question.ts`, `app/actions/stripe.ts`, `app/actions/wardrobes.ts`, `components/admin/BoutiqueItemUploader.tsx`, `components/studio/IntakeLanding.tsx` (prefer-const, 5)
- Modify: `scripts/debug-db-state.ts` (no-require-imports, 1)
- Modify: `tests/utils/supabase-mock.ts` (no-unsafe-function-type, 1)

- [ ] **Step 1: Autofix prefer-const**

Run: `npx eslint --fix app/actions/send-question.ts app/actions/stripe.ts app/actions/wardrobes.ts components/admin/BoutiqueItemUploader.tsx components/studio/IntakeLanding.tsx`
Expected: each `let` that is never reassigned becomes `const`.
Verify: `npm run lint 2>&1 | grep -c "prefer-const"` → `0`

- [ ] **Step 2: Fix no-require-imports in scripts/debug-db-state.ts**

The file already uses ESM `import` at the top (it's run via `tsx`). Replace the lone `require(...)` call with an `import`. Inspect the flagged line:
Run: `npx eslint scripts/debug-db-state.ts`
Convert the reported `const X = require('Y')` to a top-of-file `import X from 'Y';` (or `import * as X`), matching the file's existing import style.
Verify: `npx eslint scripts/debug-db-state.ts 2>&1 | grep -c "no-require-imports"` → `0`

- [ ] **Step 3: Fix no-unsafe-function-type in tests/utils/supabase-mock.ts**

Replace the bare `Function` type with a specific callable signature. Inspect:
Run: `npx eslint tests/utils/supabase-mock.ts`
Change the flagged `Function` to `(...args: unknown[]) => unknown` (or the precise signature the mock needs).
Verify: `npx eslint tests/utils/supabase-mock.ts 2>&1 | grep -c "no-unsafe-function-type"` → `0`

- [ ] **Step 4: Tests green, commit**

Run: `npm run test:run` → 223 passed.

```bash
git add app/actions/send-question.ts app/actions/stripe.ts app/actions/wardrobes.ts components/admin/BoutiqueItemUploader.tsx components/studio/IntakeLanding.tsx scripts/debug-db-state.ts tests/utils/supabase-mock.ts
git commit -m "P2: fix prefer-const, no-require-imports, no-unsafe-function-type (7 errors)"
```

---

### Task 3: no-html-link-for-pages → i18n Link (42 errors, 6 files)

**Files (all occurrences):**
- `app/[locale]/(auth)/login/page.tsx` (12)
- `app/[locale]/(auth)/forgot-password/page.tsx` (6)
- `app/[locale]/(auth)/signup/page.tsx` (6)
- `app/[locale]/vault/join/page.tsx` (6)
- `components/Contact.tsx` (6)
- `components/Hero.tsx` (6)

**Pattern.** Replace internal `<a href="/path">…</a>` with the locale-aware `Link`. Example from `components/Hero.tsx`:

```tsx
// before
<a href="/book" className="inline-block px-10 py-4 border …">{t('cta')}</a>
// after
<Link href="/book" className="inline-block px-10 py-4 border …">{t('cta')}</Link>
```

Add `import { Link } from "@/i18n/routing";` if the file lacks it (some already import `Link`/`redirect` from there — do not duplicate). `<a>` tags with a truly external `href` (`https://…`, `mailto:`) or an in-page anchor (`#…`) are NOT flagged and MUST stay `<a>`.

- [ ] **Step 1: Convert each file**

For each of the 6 files: read it, replace every ESLint-flagged internal `<a href="/…">` with `<Link href="/…">` (and matching closing tag), ensure the `@/i18n/routing` `Link` import exists once.

- [ ] **Step 2: Verify the rule is clear**

Run: `npm run lint 2>&1 | grep -c "no-html-link-for-pages"` → `0`

- [ ] **Step 3: Tests green, commit**

Run: `npm run test:run` → 223 passed.

```bash
git add "app/[locale]/(auth)/login/page.tsx" "app/[locale]/(auth)/forgot-password/page.tsx" "app/[locale]/(auth)/signup/page.tsx" "app/[locale]/vault/join/page.tsx" components/Contact.tsx components/Hero.tsx
git commit -m "P2: internal <a> -> i18n Link (no-html-link-for-pages, 42)"
```

---

### Task 4: no-unescaped-entities (59 errors, 18 files)

**Files (count):** `app/[locale]/legal/privacy/page.tsx` (31), `components/studio/TailorCard.tsx` (4), `components/boutique/ProductGrid.tsx` (3), `app/[locale]/vault/courses/[slug]/page.tsx` (2), `components/TestimonialCarousel.tsx` (2), `components/UserNotifications.tsx` (2), `components/admin/FullAccessForm.tsx` (2), `components/studio/UserAssignmentModal.tsx` (2), `components/vault/GatedWardrobe.tsx` (2), and 1 each in `app/[locale]/vault/boutique/page.tsx`, `components/admin/ChapterForm.tsx`, `components/admin/ItemForm.tsx`, `components/admin/StudioInbox.tsx`, `components/studio/IntakeLanding.tsx`, `components/studio/InvitationGenerator.tsx`, `components/studio/VirtualWardrobe.tsx`, `components/vault/TailorCardUser.tsx`, `components/vault/VaultHero.tsx`.

**Pattern.** In JSX *text*, replace bare `'` → `&apos;` and `"` → `&quot;` (or wrap the whole string in `{'…'}`). Only literal text nodes are flagged — apostrophes inside `className`, `t('…')` calls, or other attributes/expressions are fine and MUST be left alone.

```tsx
// before
<p>Here's what you'll get</p>
// after
<p>Here&apos;s what you&apos;ll get</p>
```

- [ ] **Step 1: Fix each file** (start with `privacy/page.tsx` — 31 of the 59)

For each file: read it, escape each ESLint-flagged apostrophe/quote in JSX text.

- [ ] **Step 2: Verify**

Run: `npm run lint 2>&1 | grep -c "no-unescaped-entities"` → `0`

- [ ] **Step 3: Tests green, commit**

Run: `npm run test:run` → 223 passed.

```bash
git add -A
git commit -m "P2: escape JSX entities (no-unescaped-entities, 59)"
```

---

### Task 5: no-explicit-any in the server/action layer (app/, ~33)

**Files (count):** `app/actions/essence-lab.ts` (6), `app/actions/studio.ts` (5), `app/actions/wardrobes.ts` (5), `app/actions/admin/manage-boutique-upload.ts` (2), `app/actions/commerce.ts` (2), `app/actions/dashboard.ts` (2), `app/actions/notifications.ts` (2), `app/actions/send-question.ts` (2), and 1 each in `app/actions/admin/manage-clients.ts`, `app/actions/admin/stripe-product.ts`, `app/actions/stripe.ts`, `app/[locale]/vault/courses/[slug]/essence-lab/page.tsx`, `app/[locale]/vault/courses/[slug]/page.tsx`, `app/[locale]/vault/foundations/[slug]/essence-lab/page.tsx`, `app/[locale]/vault/foundations/[slug]/page.tsx`, plus `utils/supabase/middleware.ts` (2), `utils/stripe.ts` (1), `scripts/debug-db-state.ts` (1).

**Typing philosophy (spec §Stage 3):**
1. Known shape → a real type. The dominant pattern is `catch (error: any)` → `catch (error)` then narrow with `error instanceof Error ? error.message : String(error)`. Supabase results are already typed by the client; drop the `: any`.
2. Genuinely dynamic (scraper output, arbitrary JSON) → `unknown` + narrowing.
3. True third-party gap → `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a one-line reason.

- [ ] **Step 1: Fix the `app/actions/**` files**

For each action file, run `npx eslint <file>` to list the `any` lines, then retype per the philosophy. Most are `catch (e: any)` — convert to the `instanceof Error` narrowing already used elsewhere in the codebase.

- [ ] **Step 2: Fix the `app/[locale]/**` pages, `utils/`, `scripts/`**

Same method for the remaining 1-per-file cases.

- [ ] **Step 3: Verify the layer is clean**

Run: `npx eslint app utils scripts 2>&1 | grep -c "no-explicit-any"` → `0`

- [ ] **Step 4: Tests green, commit**

Run: `npm run test:run` → 223 passed.

```bash
git add app utils scripts
git commit -m "P2: remove no-explicit-any from action/server layer (~37)"
```

---

### Task 6: no-explicit-any in components (~88)

**Files:** the 40 `components/**` files from the analysis, led by `components/studio/VirtualWardrobe.tsx` (9), `components/admin/AdminDashboard.tsx` (5), `components/admin/ClientDossier.tsx` (5), `components/admin/CollectionsManager.tsx` (5), `components/studio/DigitalLookbook.tsx` (5), `components/admin/ChapterForm.tsx` (4), `components/admin/StudioInbox.tsx` (4), `components/vault/EssenceJournal.tsx` (4), then the 3-, 2-, and 1-count files.

**Dominant pattern.** Supabase-row state: `useState<any[]>([])` and `useState<any>(null)` for DB records, plus `(x: any)` map/filter callbacks and `catch (e: any)`. Fix by:
- Introduce a shared row type per domain in a colocated `types.ts` (or reuse the zod-inferred type where a schema exists in `app/lib/validation/`). Example: `type WardrobeItem = { id: string; image_url: string | null; wardrobe_id: string | null; user_id: string | null; category: string | null; status: string; /* … */ }`, then `useState<WardrobeItem[]>([])`.
- `catch (e: any)` → narrow with `instanceof Error`.
- Event handlers → the real DOM event type (`React.ChangeEvent<HTMLInputElement>`, etc.).

Work in domain sub-batches for reviewable commits: `studio/`, then `admin/`, then `vault/` + top-level.

- [ ] **Step 1: studio/ components**

Retype every `any` in `components/studio/*` (VirtualWardrobe, DigitalLookbook, StudioDashboard, ClientSwitcher, WardrobeSwitcher, UserAssignmentModal, ClientStudioDashboard, IntakeUploader, TailorCard, WardrobeUploadLanding, ArchiveManager). Introduce a shared `WardrobeItem` type where `useState<any[]>` holds wardrobe rows.
Verify: `npx eslint components/studio 2>&1 | grep -c "no-explicit-any"` → `0`
Run: `npm run test:run` → 223 passed. Commit `P2: type studio components (no-explicit-any)`.

- [ ] **Step 2: admin/ components**

Same for `components/admin/*` (AdminDashboard, ClientDossier, CollectionsManager, ChapterForm, StudioInbox, ChaptersTable, BoutiqueManager, AdminNotificationsPanel, BrandForm, ClientList, ItemForm, ServiceForm, ServicesList, TrustedByManager, BoutiqueItemUploader, ImageUpload, MasterclassForm).
Verify: `npx eslint components/admin 2>&1 | grep -c "no-explicit-any"` → `0`
Run: `npm run test:run` → 223 passed. Commit `P2: type admin components (no-explicit-any)`.

- [ ] **Step 3: vault/ + top-level components**

Same for `components/vault/*` (EssenceJournal, GatedWardrobe, MasterclassCard, CoursePassUnlock, FullAccessUnlock, StyleCardClient) and top-level (`TrustedBy.tsx`, `UserNotifications.tsx`).
Verify: `npx eslint components 2>&1 | grep -c "no-explicit-any"` → `0`
Run: `npm run test:run` → 223 passed. Commit `P2: type vault + shared components (no-explicit-any)`.

---

### Task 7: react-hooks correctness (17 errors, reviewed individually)

**Files:** `components/auth/InteractiveGate.tsx` (rules-of-hooks, 1); `components/admin/ChaptersTable.tsx` (static-components, 6); `app/[locale]/vault/join/page.tsx`, `components/UserNotifications.tsx`, `components/admin/AdminDashboard.tsx`, `components/admin/BoutiqueManager.tsx`, `components/admin/TrustedByManager.tsx`, `components/studio/ArchiveManager.tsx` (set-state-in-effect, 1 each); `components/PhotoCarousel.tsx`, `components/TestimonialCarousel.tsx`, `components/admin/AdminNotificationsPanel.tsx`, `components/vault/EssenceJournal.tsx` (immutability, 1 each).

- [ ] **Step 1: Fix the rules-of-hooks bug in InteractiveGate.tsx**

`useEffect` is called conditionally (inside `if (type === "redirect")`, after early returns) — a real violation. Hoist it above the early returns and guard its body:

```tsx
// near the other hooks, before any early return:
useEffect(() => {
    if (isLocked && type === "redirect") {
        handleUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isLocked, type]);

// then in the redirect branch, keep only the returned JSX (remove the inline useEffect):
if (type === "redirect") {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-pulse">
            <Lock className="w-8 h-8 text-ac-gold mb-4" />
            <p className="text-ac-taupe/60 font-serif">Checking access...</p>
        </div>
    );
}
```

Verify manually: the redirect gate still navigates to `/vault/join` when locked (behavior preserved — the effect now runs unconditionally but only acts when locked+redirect).

- [ ] **Step 2: Fix static-components in ChaptersTable.tsx (6)**

A component is defined inside another component's render (recreated every render). Move the nested component definition to module scope (outside the parent function), passing what it needs via props. If the move is non-trivial or risks behavior change, STOP and surface it.
Verify: `npx eslint components/admin/ChaptersTable.tsx 2>&1 | grep -c "static-components"` → `0`

- [ ] **Step 3: Fix set-state-in-effect (6, one per file)**

For each: inspect the `useEffect` that calls `setState` synchronously. Preferred fixes, in order: derive the value during render instead of storing it; use a lazy `useState` initializer; or move the `setState` into an event handler. Only if it is a legitimate post-mount sync, keep it and add `// eslint-disable-next-line react-hooks/set-state-in-effect` with a reason. Surface any that look behavior-risky.

- [ ] **Step 4: Fix immutability (4, one per file)**

`react-hooks/immutability` flags mutating a value that should be treated as immutable (e.g. `array.sort()` on props/state, or reassigning a ref's contents). Replace in-place mutation with a copy (`[...arr].sort()`, etc.). Inspect each and fix minimally.

- [ ] **Step 5: Verify all react-hooks clear + tests green**

Run: `npm run lint 2>&1 | grep -c "react-hooks/"` → `0`
Run: `npm run test:run` → 223 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "P2: fix react-hooks errors (rules-of-hooks bug, static-components, set-state, immutability)"
```

---

### Task 8: Flip CI to blocking + docs

**Files:**
- Modify: `.github/workflows/ci.yml:27-33`
- Modify: `ROADMAP.md`, `CLAUDE.md`

- [ ] **Step 1: Confirm a fully clean lint**

Run: `npm run lint`
Expected: exit 0, **zero errors**. (Warnings may remain — that's fine.)
If any error remains, fix it before proceeding (re-run the per-rule `grep -c` checks from Tasks 2–7).

- [ ] **Step 2: Make the CI lint step blocking**

Replace lines 27-33 of `.github/workflows/ci.yml`:

```yaml
      - name: Lint
        run: npm run lint
```

(Delete the informational comment block, the `(informational)` suffix, and `continue-on-error: true`.)

- [ ] **Step 3: Update docs**

- `CLAUDE.md` Commands section: change the `npm run lint` line to note it is now a **required, blocking** gate (no longer informational).
- `ROADMAP.md`: mark the P2 `no-explicit-any` / lint-gate item done (2026-07-12); note the finding that ~1,248 of the original count were gitignored tooling dirs. Warnings backlog (`no-img-element` etc.) remains a separate future item.

- [ ] **Step 4: Full verification**

Run: `npm run test:run` → 223 passed.
Run: `npm run lint` → exit 0.
Run: `npm run build` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml ROADMAP.md CLAUDE.md
git commit -m "P2: make CI lint a blocking gate; docs"
```

---

## Self-Review Notes

- **Spec coverage:** Stage 1 → Task 1; Stage 2 (mechanical) → Tasks 2 (prefer-const/require/function-type), 3 (html-link), 4 (unescaped-entities); Stage 3 (`any`) → Tasks 5 (server/actions), 6 (components); Stage 4 (react-hooks) → Task 7; Stage 5 (CI flip + docs) → Task 8. Verification method (per-rule `grep -c`, tests, build) present in every task.
- **Count reconciliation:** measured post-config total is 250: any 125 (Task 5 ~37 in app/utils/scripts + Task 6 ~88 components), unescaped 59 (Task 4), html-link 42 (Task 3), react-hooks 17 (Task 7), prefer-const 5 + require 1 + unsafe-function 1 (Task 2). 125+59+42+17+7 = 250. ✓
- **Deliberate deviation from spec:** spec estimated react-hooks at ~9 and unescaped at 67; measured (post gitignore + tests-relax) is 17 and 59. Plan uses the measured figures. No scope change.
- **Behavior risk:** Task 7 is the only task touching runtime logic; each step carries an explicit "surface if risky" instruction per the Global Constraints.
