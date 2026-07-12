# Design: Zod Input Validation for Admin Server Actions

**Date:** 2026-07-10
**Status:** Approved (pending spec review)
**Branch:** `Dev`
**Roadmap item:** Phase 1 — "zod input validation on server actions, starting with admin writes that spread `data: any` into inserts with no validation."

## Problem

Five admin action files accept unvalidated client input:

- **Mass assignment (worst):** `upsertOffer(offerData: any)`
  (`app/actions/admin/manage-offers.ts`) and `upsertService(serviceData: any)`
  (`app/actions/admin/manage-services.ts`) spread the raw client object straight
  into `.upsert()`. Any column of `offers` / `services` can be written by a
  tampered request from an admin session.
- **Crash path:** `createChapter` / `updateChapter`
  (`app/actions/admin/manage-chapters.ts`) run unguarded `JSON.parse` on
  client-supplied strings (`labQuestions`, `takeaways`, `takeawaysEs`,
  `resourceUrls`). Malformed JSON throws an unhandled server error instead of
  returning the `{ error }` shape the forms handle.
- **No validation:** `manage-boutique.ts` maps columns explicitly (no injection)
  but accepts missing names, NaN commission rates, invalid emails — failures
  surface as raw Postgres errors or silently insert nulls.
- **Duplicated auth:** offers/services use inline role queries;
  chapters/masterclasses each carry a private `checkAdmin()` — while the tested
  `requireAdmin()` guard already exists in `app/lib/auth-guards.ts`.

## Decisions (confirmed with user)

1. **Consolidate auth guards now**: the five touched files move to
   `requireAdmin()`; untouched files wait for Phase 2.
2. **Pragmatic strictness**: required fields enforced; when validation fails the
   admin gets a **human-readable message telling them how to move forward**,
   surfaced through the forms' existing `toast.error(res.error)`.
3. **Single-string errors** in the existing `{ success, error }` return shape —
   zero form changes.

## Constraint that shapes the layout

Next.js requires every export of a `"use server"` file to be an async function,
so zod schemas **cannot** live in the action files. They get their own module.

## Approach

Chosen of three considered:

1. **Schema module + explicit `parseInput` helper (chosen).** Schemas per domain
   in `app/lib/validation/`; each action calls `requireAdmin()` then
   `parseInput(schema, input)` — both returning the same `ok`-style result. The
   DB row is built **only from schema output**, which kills mass assignment.
   Explicit, greppable, matches the existing guard idiom.
2. Higher-order wrapper (`validatedAdminAction(schema, handler)`). Rejected: more
   magic, changes the action shape, inconsistent with the explicit-guard style
   the codebase just standardized on.
3. Validate inline per action without a shared helper. Rejected: five files
   would each reinvent error flattening and empty-string handling.

Zod v4 (`npm i zod`) — no DB migrations needed for this task.

## Module layout — `app/lib/validation/`

### `parse.ts` — core helper + shared field primitives

```ts
export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>>
```

- Flattens `ZodError` into one readable sentence with field labels, e.g.
  `"Please fix the following: Name is required; Commission rate must be a number."`
- Shared primitives:
  - `requiredText(label)` — trimmed non-empty string; message "<Label> is required".
  - `optionalText` — trims; empty string → `null` (preserves current `|| null` behavior).
  - `optionalNumber` — coerces `"12.5"` → `12.5`; empty/absent → `null`; NaN → error.
  - `jsonArray(label)` — accepts an array as-is, or a string safely
    `JSON.parse`d; bad JSON becomes a zod issue (not a throw).
  - `uuid(label)` / `optionalUuid` — friendly message instead of a PG cast error;
    empty string → `null` for the optional variant.

### Per-domain schema files

Schema **output keys = DB column names**, so actions insert `parsed.data`
directly (or spread it into an explicit row). Enums mirror the DB CHECK
constraints so admins get a friendly message instead of a check-violation error.

| File | Schemas | Key rules |
|---|---|---|
| `boutique.ts` | `brandSchema`, `boutiqueItemSchema`, `collectionSchema`, `trustedByLogoSchema` | brand: `name` required, `contact_email` valid email or null, `commission_rate` coerced number or null, `partnership_status` ∈ active/prospect/paused/inactive; item: `name` + `image_url` required, `brand_id` uuid-or-null (empty string → null); collection: `title` required, `order_index` coerced int; logo: `name` + `logo_url` required |
| `offers.ts` | `offerSchema` | optional uuid `id`, required `slug` + `title`, optional text fields, `active` boolean |
| `services.ts` | `serviceSchema` | optional uuid `id`, required `title`, `type` ∈ session/retainer, `recommendation_tags` string array, coerced `order_index`, booleans |
| `chapters.ts` | `chapterSchema` | required `slug`/`title`/`video_id` (DB NOT NULL), `category` ∈ masterclass/course, coerced `order_index`, the four jsonb fields via `jsonArray`, `masterclass_id` uuid-or-null |
| `masterclasses.ts` | `masterclassSchema` | required `title`, optional rest, coerced `order_index` |

## Action pattern (applied to all five files)

```ts
export async function createBrand(data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(brandSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase.from('partner_brands').insert(parsed.data);
    // ... unchanged error handling + revalidatePath
}
```

- Public signatures change `any` → `unknown`; callers unaffected.
- `manage-chapters.ts` / `manage-masterclasses.ts` **keep their `FormData`
  signatures** (forms unchanged): extract FormData → plain object → validate.
  `JSON.parse` moves into `jsonArray`, so bad JSON returns `{ error }`. The
  local `checkAdmin()` copies are deleted in favor of `requireAdmin`.
- `manage-offers.ts` / `manage-services.ts`: inline role queries →
  `requireAdmin`; upsert only schema-derived rows (mass-assignment fix).
  `getOffer` / `getServices` reads stay as-is.
- `id` params on update/delete actions validated as uuid; `setCollectionItems`
  validates a uuid array.
- Preserve existing success payloads (`{ id }`, `{ chapter }`,
  `{ masterclass }`) and every `revalidatePath` call.

## Testing

TDD per task; suite must stay green (161 existing tests).

- `tests/unit/validation.test.ts` — `parseInput` message formatting, primitives
  (empty-string → null, coercion, NaN rejection, safe JSON).
- Per-action tests (pattern of the existing `manage-boutique.test.ts`):
  - invalid input → `{ success: false }` with a readable, field-naming error and
    **no DB call**;
  - valid input → row contains exactly the mapped columns;
  - **mass-assignment regression**: an unknown/tampered key (e.g. `role`) never
    reaches `.upsert`;
  - malformed JSON in chapter fields → `{ error }`, not a throw;
  - unauthenticated / non-admin still rejected before validation.

## Out of scope

- Non-admin actions (studio/vault/auth) — this establishes the pattern; broader
  rollout rides the Phase 2 `any` cleanup.
- Per-field error display in forms (`fieldErrors`) — nothing consumes it today.
- Wardrobe storage-folder normalization — next Phase 1 task, separate design.
