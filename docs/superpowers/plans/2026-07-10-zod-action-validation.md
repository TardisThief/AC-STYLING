# Zod Admin-Action Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate all client input at the boundary of the five admin action files (`manage-boutique`, `manage-offers`, `manage-services`, `manage-chapters`, `manage-masterclasses`) with zod, killing the raw-spread mass assignment in the offers/services upserts and the `JSON.parse` crash path in chapters, while consolidating the touched files onto `requireAdmin()`.

**Architecture:** New `app/lib/validation/` module — `parse.ts` holds a `parseInput(schema, input)` helper (returns the same `ok`-style result as `GuardResult`) plus shared field primitives; one schema file per domain with **output keys = DB column names** so actions write `parsed.data` directly. Actions: guard → parse → write. Validation failures return one human-readable string in the existing `{ success, error }` shape, surfaced by the admin forms' `toast.error(res.error)`.

**Tech Stack:** Next.js 16 server actions, zod v4, Supabase JS, Vitest (mocks per `tests/unit/manage-boutique.test.ts` pattern).

**Spec:** `docs/superpowers/specs/2026-07-10-zod-action-validation-design.md`

## Global Constraints

- Work on the `Dev` branch. No merge/deploy; the user does that. No DB migrations needed for this task.
- Zod schemas must NOT live in `"use server"` files (Next requires every export there to be an async function). Module-private (non-exported) sync helpers inside action files are fine.
- Public action signatures change `any` → `unknown`; `FormData` signatures stay `FormData` (forms unchanged).
- Preserve existing success payloads (`{ id }`, `{ chapter }`, `{ masterclass }`), every `revalidatePath` call, and the `Unauthorized` / `Forbidden` error strings from `requireAdmin`.
- Error strings must name the field and how to fix it, e.g. `"Please fix the following: Name is required"`.
- **Upsert semantics:** for `offers`/`services` payloads and `updateTrustedByLogo`, keys absent from the input must stay absent from the DB write (don't null-overwrite columns the form never sends — TrustedByManager sends `{ active }` alone). For the explicit-mapping actions (brands, items, collections, chapters, masterclasses) absent optional fields become `null`, matching the current `|| null` behavior.
- Full suite (`npm run test:run`, 161 tests) stays green; `npm run lint` shows no new errors in touched files.

---

### Task 1: zod dependency + `parse.ts` core helper and field primitives

**Files:**
- Create: `app/lib/validation/parse.ts`
- Test: `tests/unit/validation.test.ts`
- Modify: `package.json` / `package-lock.json` (via `npm i zod`)

**Interfaces (later tasks rely on these exact exports from `@/app/lib/validation/parse`):**
- `type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }`
- `parseInput<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>>`
- `requiredText(label: string)` — trimmed non-empty string; "<Label> is required"
- `optionalText` — string|null|undefined → trimmed string or `null`
- `optionalTextPreserve` — like `optionalText` but an absent object key stays absent
- `optionalNumber(label: string)` — number|numeric-string → number; ''/null/undefined → null; NaN → "<Label> must be a number"
- `orderIndex` — ''/null/undefined → 0; coerced integer; "Order must be a number"/"Order must be a whole number"
- `uuid(label: string)` — "<Label> is invalid"
- `optionalUuid(label: string)` — ''/null/undefined → null
- `upsertId(label: string)` — ''/null → absent (so insert path of upsert uses the DB default)
- `jsonArray(label: string)` — array passes; string is safely JSON.parsed ("<Label> contains invalid JSON" / "<Label> must be a list"); ''/null/undefined → `[]`
- `booleanish` — `true`/`'true'` → true, anything else → false

- [ ] **Step 1: Install zod**

Run: `npm i zod`
Expected: zod v4.x added to `dependencies`, no peer-dependency errors.

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
    parseInput,
    requiredText,
    optionalText,
    optionalTextPreserve,
    optionalNumber,
    orderIndex,
    uuid,
    optionalUuid,
    upsertId,
    jsonArray,
    booleanish,
} from '@/app/lib/validation/parse'

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

describe('parseInput', () => {
    const schema = z.object({ name: requiredText('Name'), rate: optionalNumber('Rate') })

    it('returns ok with parsed data for valid input', () => {
        const result = parseInput(schema, { name: '  Zara  ', rate: '12.5' })
        expect(result).toEqual({ ok: true, data: { name: 'Zara', rate: 12.5 } })
    })

    it('flattens all issues into one readable message', () => {
        const result = parseInput(schema, { name: '', rate: 'abc' })
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toBe('Please fix the following: Name is required; Rate must be a number')
        }
    })

    it('rejects non-object input without throwing', () => {
        const result = parseInput(schema, null)
        expect(result.ok).toBe(false)
    })
})

describe('field primitives', () => {
    it('requiredText rejects missing, empty, and non-string values with the label', () => {
        const s = z.object({ name: requiredText('Name') })
        for (const bad of [{}, { name: '' }, { name: '   ' }, { name: 42 }]) {
            const r = parseInput(s, bad)
            expect(r.ok).toBe(false)
            if (!r.ok) expect(r.error).toContain('Name is required')
        }
    })

    it('optionalText: empty/null/undefined become null; values are trimmed', () => {
        expect(optionalText.parse('')).toBeNull()
        expect(optionalText.parse(null)).toBeNull()
        expect(optionalText.parse(undefined)).toBeNull()
        expect(optionalText.parse('  hi  ')).toBe('hi')
    })

    it('optionalTextPreserve: absent key stays absent, present empty becomes null', () => {
        const s = z.object({ title_es: optionalTextPreserve })
        expect(s.parse({})).toEqual({})
        expect(s.parse({ title_es: '' })).toEqual({ title_es: null })
        expect(s.parse({ title_es: 'Hola' })).toEqual({ title_es: 'Hola' })
    })

    it('optionalNumber: coerces numeric strings, empties to null, NaN errors', () => {
        const n = optionalNumber('Rate')
        expect(n.parse('12.5')).toBe(12.5)
        expect(n.parse(7)).toBe(7)
        expect(n.parse('')).toBeNull()
        expect(n.parse(null)).toBeNull()
        expect(n.parse(undefined)).toBeNull()
        expect(() => n.parse('abc')).toThrow(/Rate must be a number/)
    })

    it('orderIndex: empties default to 0, coerces, rejects fractions', () => {
        expect(orderIndex.parse('')).toBe(0)
        expect(orderIndex.parse(null)).toBe(0)
        expect(orderIndex.parse(undefined)).toBe(0)
        expect(orderIndex.parse('7')).toBe(7)
        expect(orderIndex.parse(3)).toBe(3)
        expect(() => orderIndex.parse('abc')).toThrow(/Order must be a number/)
        expect(() => orderIndex.parse(2.5)).toThrow(/Order must be a whole number/)
    })

    it('uuid: passes a valid uuid, names the label on failure', () => {
        expect(uuid('Item id').parse(VALID_UUID)).toBe(VALID_UUID)
        expect(() => uuid('Item id').parse('nope')).toThrow(/Item id is invalid/)
    })

    it('optionalUuid: empty/null/undefined become null', () => {
        const u = optionalUuid('Brand')
        expect(u.parse('')).toBeNull()
        expect(u.parse(null)).toBeNull()
        expect(u.parse(undefined)).toBeNull()
        expect(u.parse(VALID_UUID)).toBe(VALID_UUID)
        expect(() => u.parse('nope')).toThrow(/Brand is invalid/)
    })

    it('upsertId: empty/absent leaves the key out so DB defaults apply', () => {
        const s = z.object({ id: upsertId('Offer id') })
        expect(s.parse({})).toEqual({})
        expect(s.parse({ id: '' })).toEqual({})
        expect(s.parse({ id: VALID_UUID })).toEqual({ id: VALID_UUID })
        expect(() => s.parse({ id: 'nope' })).toThrow(/Offer id is invalid/)
    })

    it('jsonArray: parses JSON strings, passes arrays, friendly errors otherwise', () => {
        const j = jsonArray('Takeaways')
        expect(j.parse('["a","b"]')).toEqual(['a', 'b'])
        expect(j.parse([1, 2])).toEqual([1, 2])
        expect(j.parse('')).toEqual([])
        expect(j.parse(null)).toEqual([])
        expect(j.parse(undefined)).toEqual([])
        expect(() => j.parse('{not json')).toThrow(/Takeaways contains invalid JSON/)
        expect(() => j.parse('"not-an-array"')).toThrow(/Takeaways must be a list/)
    })

    it('booleanish: true only for true/"true"', () => {
        expect(booleanish.parse(true)).toBe(true)
        expect(booleanish.parse('true')).toBe(true)
        expect(booleanish.parse('false')).toBe(false)
        expect(booleanish.parse(null)).toBe(false)
        expect(booleanish.parse(undefined)).toBe(false)
    })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/validation.test.ts`
Expected: FAIL — cannot resolve `@/app/lib/validation/parse`.

- [ ] **Step 4: Write the implementation**

Create `app/lib/validation/parse.ts`:

```ts
import { z } from 'zod';

/**
 * Result of validating action input. Mirrors GuardResult (auth-guards.ts) so
 * actions read: guard → parse → write, each returning early on failure.
 */
export type ParseResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

/**
 * Validate `input` against `schema`. On failure, flattens every issue into one
 * human-readable sentence — the admin forms surface it via toast.error(res.error).
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>> {
    const result = schema.safeParse(input);
    if (result.success) return { ok: true, data: result.data };

    const messages = [...new Set(result.error.issues.map(issue => issue.message))];
    return { ok: false, error: `Please fix the following: ${messages.join('; ')}` };
}

// --- Shared field primitives ---
// Schema output keys are DB column names, so actions can write parsed.data as-is.

/** Non-empty trimmed string; "<Label> is required" on missing/empty/wrong type. */
export const requiredText = (label: string) =>
    z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`);

/**
 * Optional free text: trims; absent/null/empty all become null — matches the
 * `data.x || null` behavior the actions had before.
 */
export const optionalText = z
    .string()
    .nullish()
    .transform(value => {
        const trimmed = value?.trim();
        return trimmed ? trimmed : null;
    });

/**
 * Like optionalText, but an ABSENT key stays absent so partial payloads (the
 * offers/services upserts, TrustedBy toggles) don't null-overwrite columns the
 * form never sent. Present-but-empty still becomes null.
 */
export const optionalTextPreserve = optionalText.optional();

/** Optional number: coerces numeric strings; ''/null/undefined → null; NaN → error. */
export const optionalNumber = (label: string) =>
    z.preprocess(
        value => (value === '' || value === null || value === undefined ? null : value),
        z.coerce.number({ error: `${label} must be a number` }).nullable(),
    );

/** Whole-number ordering index; ''/null/undefined default to 0. */
export const orderIndex = z.preprocess(
    value => (value === '' || value === null || value === undefined ? 0 : value),
    z.coerce.number({ error: 'Order must be a number' }).int('Order must be a whole number'),
);

/** UUID with a friendly error naming the record. */
export const uuid = (label: string) => z.uuid({ error: `${label} is invalid` });

/** UUID or null; ''/null/undefined → null (forms send '' for "none"). */
export const optionalUuid = (label: string) =>
    z.preprocess(
        value => (value === '' || value === null || value === undefined ? null : value),
        uuid(label).nullable(),
    );

/** UUID or absent; ''/null → absent so an upsert's insert path uses the DB default id. */
export const upsertId = (label: string) =>
    z.preprocess(
        value => (value === '' || value === null ? undefined : value),
        uuid(label).optional(),
    );

/**
 * A jsonb array column fed either a real array or a JSON string from a form
 * field. Malformed JSON becomes a validation issue instead of a thrown error.
 */
export const jsonArray = (label: string) =>
    z.preprocess((value, ctx) => {
        if (value === '' || value === null || value === undefined) return [];
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                ctx.addIssue({ code: 'custom', message: `${label} contains invalid JSON` });
                return z.NEVER;
            }
        }
        return value;
    }, z.array(z.unknown(), { error: `${label} must be a list` }));

/** Boolean from a form value: true/'true' → true, anything else → false. */
export const booleanish = z.preprocess(
    value => value === true || value === 'true',
    z.boolean(),
);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/validation.test.ts`
Expected: PASS (13 tests). If a zod v4 API mismatch surfaces (e.g. `error` param or `z.uuid` shape), fix the implementation — not the intent of the test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app/lib/validation/parse.ts tests/unit/validation.test.ts
git commit -m "P1: add zod validation core (parseInput + shared field primitives)"
```

---

### Task 2: Boutique schemas + `manage-boutique.ts` at the boundary

**Files:**
- Create: `app/lib/validation/boutique.ts`
- Modify: `app/actions/admin/manage-boutique.ts`
- Test: `tests/unit/manage-boutique.test.ts` (extend; keep the existing 3 `getAdminBrands` tests passing)

**Interfaces:**
- Consumes: Task 1 exports from `@/app/lib/validation/parse`.
- Produces from `@/app/lib/validation/boutique`: `brandSchema`, `boutiqueItemSchema`, `collectionSchema`, `trustedByLogoSchema`, `trustedByLogoUpdateSchema`.

- [ ] **Step 1: Write the failing tests**

Replace the mock header of `tests/unit/manage-boutique.test.ts` so non-`profiles` tables route to a controllable `mockWriteFrom`, and add write-action suites. Full new file content:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createChainableMock } from '../utils/supabase-mock'

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'
const OTHER_UUID = '223e4567-e89b-12d3-a456-426614174000'

// Service-role client used by getAdminBrands to read sensitive columns.
const mockAdminFrom = vi.fn()
vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

// RLS-respecting server client. `profiles` serves requireAdmin's role check;
// every other table routes to mockWriteFrom so tests can observe writes.
const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'
const mockWriteFrom = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
                }
            }
            return mockWriteFrom(table)
        }),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
    getAdminBrands,
    createBrand,
    updateBrand,
    deleteBrand,
    createBoutiqueItem,
    createCollection,
    setCollectionItems,
    createTrustedByLogo,
    updateTrustedByLogo,
} from '@/app/actions/admin/manage-boutique'

beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRole = 'admin'
    mockWriteFrom.mockImplementation(() => createChainableMock({ data: null, error: null }))
})

describe('getAdminBrands', () => {
    it('rejects unauthenticated callers before touching the service role', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } })

        const result = await getAdminBrands()

        expect(result.success).toBe(false)
        expect(result.error).toBe('Unauthorized')
        expect(mockAdminFrom).not.toHaveBeenCalled()
    })

    it('rejects authenticated non-admin callers', async () => {
        mockRole = 'user'

        const result = await getAdminBrands()

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
        expect(mockAdminFrom).not.toHaveBeenCalled()
    })

    it('returns full brand rows (including sensitive fields) for an admin', async () => {
        const brands = [{ id: '1', name: 'Zara', internal_notes: 'secret', commission_rate: 0.15 }]
        mockAdminFrom.mockReturnValue(createChainableMock({ data: brands, error: null }))

        const result = await getAdminBrands()

        expect(result.success).toBe(true)
        expect(result.brands).toHaveLength(1)
        expect(result.brands?.[0].internal_notes).toBe('secret')
    })
})

describe('createBrand', () => {
    it('rejects a missing name with a readable error and no DB write', async () => {
        const result = await createBrand({ name: '', logo_url: 'https://x.test/logo.png' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Name is required')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('rejects an invalid contact email by name', async () => {
        const result = await createBrand({ name: 'Zara', contact_email: 'not-an-email' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Contact email must be a valid email address')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('rejects a non-numeric commission rate', async () => {
        const result = await createBrand({ name: 'Zara', commission_rate: 'abc' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Commission rate must be a number')
    })

    it('inserts exactly the schema columns, with coercion and empty→null', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom.mockReturnValue({ insert })

        const result = await createBrand({
            name: '  Zara  ',
            logo_url: '',
            website_url: 'https://zara.com',
            contact_name: '',
            contact_email: '',
            commission_rate: '12.5',
            partnership_status: '',
            internal_notes: '',
        })

        expect(result.success).toBe(true)
        expect(mockWriteFrom).toHaveBeenCalledWith('partner_brands')
        expect(insert).toHaveBeenCalledWith({
            name: 'Zara',
            logo_url: null,
            website_url: 'https://zara.com',
            active: true,
            contact_name: null,
            contact_email: null,
            commission_rate: 12.5,
            partnership_status: 'active',
            internal_notes: null,
        })
    })

    it('rejects non-admins before validating', async () => {
        mockRole = 'user'

        const result = await createBrand({ name: 'Zara' })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
    })
})

describe('updateBrand / deleteBrand', () => {
    it('updateBrand rejects a malformed id before writing', async () => {
        const result = await updateBrand('not-a-uuid', { name: 'Zara' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Brand id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('updateBrand writes the parsed row for a valid id', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        const update = vi.fn(() => ({ eq }))
        mockWriteFrom.mockReturnValue({ update })

        const result = await updateBrand(VALID_UUID, { name: 'Zara', active: false })

        expect(result.success).toBe(true)
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Zara', active: false }))
        expect(eq).toHaveBeenCalledWith('id', VALID_UUID)
    })

    it('deleteBrand rejects a malformed id', async () => {
        const result = await deleteBrand('nope')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Brand id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })
})

describe('createBoutiqueItem', () => {
    it('requires name and image URL', async () => {
        const result = await createBoutiqueItem({ name: '', image_url: '' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Name is required')
        expect(result.error).toContain('Image URL is required')
    })

    it('turns an empty brand_id into null', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom.mockReturnValue({ insert })

        const result = await createBoutiqueItem({ name: 'Bag', image_url: 'https://x.test/b.jpg', brand_id: '' })

        expect(result.success).toBe(true)
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ brand_id: null }))
    })
})

describe('collections', () => {
    it('createCollection returns the new id and requires a title', async () => {
        const single = vi.fn().mockResolvedValue({ data: { id: VALID_UUID }, error: null })
        const select = vi.fn(() => ({ single }))
        const insert = vi.fn(() => ({ select }))
        mockWriteFrom.mockReturnValue({ insert })

        const ok = await createCollection({ title: 'Summer', order_index: 2 })
        expect(ok).toEqual({ success: true, id: VALID_UUID })
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Summer', order_index: 2, active: true }))

        const bad = await createCollection({ title: '' })
        expect(bad.success).toBe(false)
        expect(bad.error).toContain('Title is required')
    })

    it('setCollectionItems validates every id before deleting/inserting', async () => {
        const result = await setCollectionItems(VALID_UUID, ['not-a-uuid'])

        expect(result.success).toBe(false)
        expect(result.error).toContain('Item id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('setCollectionItems replaces rows for valid ids', async () => {
        const del = { delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) }
        const insert = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom
            .mockReturnValueOnce(del)
            .mockReturnValueOnce({ insert })

        const result = await setCollectionItems(VALID_UUID, [OTHER_UUID])

        expect(result.success).toBe(true)
        expect(insert).toHaveBeenCalledWith([
            { collection_id: VALID_UUID, item_id: OTHER_UUID, position: 0 },
        ])
    })
})

describe('trusted-by logos', () => {
    it('createTrustedByLogo requires name and logo URL', async () => {
        const result = await createTrustedByLogo({ name: '', logo_url: '' } as never)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Name is required')
        expect(result.error).toContain('Logo URL is required')
    })

    it('updateTrustedByLogo passes through only the keys provided (partial update)', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        const update = vi.fn(() => ({ eq }))
        mockWriteFrom.mockReturnValue({ update })

        const result = await updateTrustedByLogo(VALID_UUID, { active: false })

        expect(result.success).toBe(true)
        expect(update).toHaveBeenCalledWith({ active: false })
    })
})
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/unit/manage-boutique.test.ts`
Expected: the 3 `getAdminBrands` tests PASS; the new suites FAIL (no validation yet — e.g. `createBrand({name:''})` currently reaches the DB mock and "succeeds", and `@/app/lib/validation/boutique` doesn't exist).

- [ ] **Step 3: Write the schemas**

Create `app/lib/validation/boutique.ts`:

```ts
import { z } from 'zod';
import { requiredText, optionalText, optionalNumber, optionalUuid, orderIndex } from './parse';

export const brandSchema = z.object({
    name: requiredText('Name'),
    logo_url: optionalText,
    website_url: optionalText,
    active: z.boolean().optional().default(true),
    contact_name: optionalText,
    contact_email: z.preprocess(
        value => (value === '' || value === null || value === undefined ? null : value),
        z.email({ error: 'Contact email must be a valid email address' }).nullable(),
    ),
    commission_rate: optionalNumber('Commission rate'),
    // Mirrors the DB CHECK constraint so admins get a readable message.
    partnership_status: z.preprocess(
        value => value || 'active',
        z.enum(['active', 'prospect', 'paused', 'inactive'], {
            error: 'Partnership status must be active, prospect, paused, or inactive',
        }),
    ),
    internal_notes: optionalText,
});

export const boutiqueItemSchema = z.object({
    name: requiredText('Name'),
    brand_id: optionalUuid('Brand'),
    image_url: requiredText('Image URL'),
    curator_note: optionalText,
    affiliate_url_usa: optionalText,
    affiliate_url_es: optionalText,
    category: optionalText,
    active: z.boolean().optional().default(true),
});

export const collectionSchema = z.object({
    title: requiredText('Title'),
    title_es: optionalText,
    description: optionalText,
    description_es: optionalText,
    cover_image_url: optionalText,
    active: z.boolean().optional().default(true),
    order_index: orderIndex,
});

export const trustedByLogoSchema = z.object({
    name: requiredText('Name'),
    logo_url: requiredText('Logo URL'),
    order_index: orderIndex,
});

/** Partial update: TrustedByManager sends e.g. { active } or { order_index } alone. */
export const trustedByLogoUpdateSchema = trustedByLogoSchema
    .extend({ active: z.boolean() })
    .partial();
```

- [ ] **Step 4: Rewrite `app/actions/admin/manage-boutique.ts`**

Full new content (reads unchanged; every write guarded then parsed; ids validated):

```ts

'use server';

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/app/lib/auth-guards";
import { parseInput, uuid } from "@/app/lib/validation/parse";
import {
    brandSchema,
    boutiqueItemSchema,
    collectionSchema,
    trustedByLogoSchema,
    trustedByLogoUpdateSchema,
} from "@/app/lib/validation/boutique";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// --- Brands ---

/**
 * Fetch full partner_brand rows (including internal_notes / commission_rate /
 * contact_email) for the admin editor. Uses the service-role client so it can
 * read the sensitive columns that are column-revoked from anon/authenticated;
 * gated by requireAdmin so only admins reach it.
 */
export async function getAdminBrands() {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const supabase = createAdminClient();
    const { data: brands, error } = await supabase
        .from('partner_brands')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) {
        console.error("Fetch Admin Brands Error:", error);
        return { success: false, error: error.message };
    }

    return { success: true, brands };
}

export async function createBrand(data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(brandSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase.from('partner_brands').insert(parsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function updateBrand(id: string, data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Brand id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(brandSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('partner_brands')
        .update(parsed.data)
        .eq('id', idParsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function deleteBrand(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Brand id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase.from('partner_brands').delete().eq('id', idParsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

// --- Items ---

export async function createBoutiqueItem(data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(boutiqueItemSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase.from('boutique_items').insert(parsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function updateBoutiqueItem(id: string, data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Item id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(boutiqueItemSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('boutique_items')
        .update(parsed.data)
        .eq('id', idParsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function deleteBoutiqueItem(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Item id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase.from('boutique_items').delete().eq('id', idParsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

// --- Collections ---

export async function getCollections() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('boutique_collections')
        .select('*, items:boutique_collection_items(item_id)')
        .order('order_index', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, collections: data || [] };
}

export async function createCollection(data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(collectionSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { data: created, error } = await auth.supabase
        .from('boutique_collections')
        .insert(parsed.data)
        .select('id')
        .single();

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true, id: created.id };
}

export async function updateCollection(id: string, data: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Collection id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(collectionSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('boutique_collections')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', idParsed.data);

    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function deleteCollection(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Collection id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase
        .from('boutique_collections')
        .delete()
        .eq('id', idParsed.data);
    if (error) return { success: false, error: error.message };
    revalidatePath('/vault/boutique');
    return { success: true };
}

export async function setCollectionItems(collectionId: string, itemIds: string[]) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Collection id'), collectionId);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const itemsParsed = parseInput(z.array(uuid('Item id')), itemIds);
    if (!itemsParsed.ok) return { success: false, error: itemsParsed.error };

    // Replace all items for this collection
    await auth.supabase.from('boutique_collection_items').delete().eq('collection_id', idParsed.data);

    if (itemsParsed.data.length > 0) {
        const rows = itemsParsed.data.map((item_id, idx) => ({
            collection_id: idParsed.data,
            item_id,
            position: idx,
        }));
        const { error } = await auth.supabase.from('boutique_collection_items').insert(rows);
        if (error) return { success: false, error: error.message };
    }

    revalidatePath('/vault/boutique');
    return { success: true };
}

// --- Trusted By ---

export async function getTrustedByLogos() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('trusted_by_logos')
        .select('*')
        .order('order_index', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, logos: data || [] };
}

export async function createTrustedByLogo(data: { name: string; logo_url: string; order_index?: number }) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(trustedByLogoSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase.from('trusted_by_logos').insert({
        ...parsed.data,
        active: true,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath('/');
    return { success: true };
}

export async function updateTrustedByLogo(id: string, data: Partial<{ name: string; logo_url: string; order_index: number; active: boolean }>) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Logo id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(trustedByLogoUpdateSchema, data);
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('trusted_by_logos')
        .update(parsed.data)
        .eq('id', idParsed.data);
    if (error) return { success: false, error: error.message };
    revalidatePath('/');
    return { success: true };
}

export async function deleteTrustedByLogo(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Logo id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase.from('trusted_by_logos').delete().eq('id', idParsed.data);
    if (error) return { success: false, error: error.message };
    revalidatePath('/');
    return { success: true };
}
```

(Note: `createTrustedByLogo`/`updateTrustedByLogo` keep their existing typed signatures — they're already narrow — but now actually validate at runtime.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/manage-boutique.test.ts`
Expected: PASS (3 existing + 14 new).

- [ ] **Step 6: Commit**

```bash
git add app/lib/validation/boutique.ts app/actions/admin/manage-boutique.ts tests/unit/manage-boutique.test.ts
git commit -m "P1: zod-validate all manage-boutique writes (brands, items, collections, logos)"
```

---

### Task 3: Offers + services — mass-assignment fix, `requireAdmin`

**Files:**
- Create: `app/lib/validation/offers.ts`, `app/lib/validation/services.ts`
- Modify: `app/actions/admin/manage-offers.ts`, `app/actions/admin/manage-services.ts`
- Test: `tests/unit/manage-offers.test.ts`, `tests/unit/manage-services.test.ts` (new)

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `offerSchema` from `@/app/lib/validation/offers`, `serviceSchema` from `@/app/lib/validation/services`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/manage-offers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'
const mockWriteFrom = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
                }
            }
            return mockWriteFrom(table)
        }),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { upsertOffer } from '@/app/actions/admin/manage-offers'

function upsertChain() {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null })
    const select = vi.fn(() => ({ single }))
    const upsert = vi.fn(() => ({ select }))
    return { upsert }
}

beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRole = 'admin'
})

describe('upsertOffer', () => {
    it('rejects unauthenticated and non-admin callers', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } })
        expect((await upsertOffer({ slug: 's', title: 't' })).error).toBe('Unauthorized')

        mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
        mockRole = 'user'
        expect((await upsertOffer({ slug: 's', title: 't' })).error).toBe('Forbidden')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('requires slug and title with readable errors', async () => {
        const result = await upsertOffer({ slug: '', title: '' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Slug is required')
        expect(result.error).toContain('Title is required')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('strips unknown columns — mass-assignment regression guard', async () => {
        const chain = upsertChain()
        mockWriteFrom.mockReturnValue(chain)

        const result = await upsertOffer({
            slug: 'full_access',
            title: 'Full Access',
            active: true,
            // tampered keys that must never reach the DB write:
            created_at: '1999-01-01T00:00:00Z',
            granted_by: 'attacker',
        })

        expect(result.success).toBe(true)
        const row = chain.upsert.mock.calls[0][0]
        expect(row).not.toHaveProperty('created_at')
        expect(row).not.toHaveProperty('granted_by')
        expect(row).toMatchObject({ slug: 'full_access', title: 'Full Access', active: true })
    })

    it('omits absent optional columns so the upsert cannot null them out', async () => {
        const chain = upsertChain()
        mockWriteFrom.mockReturnValue(chain)

        await upsertOffer({ id: VALID_UUID, slug: 'course_pass', title: 'Course Pass' })

        const row = chain.upsert.mock.calls[0][0]
        expect(row).not.toHaveProperty('title_es')
        expect(row).not.toHaveProperty('description_es')
        expect(row.id).toBe(VALID_UUID)
    })

    it('drops an empty-string id so the insert path uses the DB default', async () => {
        const chain = upsertChain()
        mockWriteFrom.mockReturnValue(chain)

        await upsertOffer({ id: '', slug: 'full_access', title: 'Full Access' })

        expect(chain.upsert.mock.calls[0][0]).not.toHaveProperty('id')
    })
})
```

Create `tests/unit/manage-services.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'
const mockWriteFrom = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
                }
            }
            return mockWriteFrom(table)
        }),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { upsertService, deleteService } from '@/app/actions/admin/manage-services'

function upsertChain() {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null })
    const select = vi.fn(() => ({ single }))
    const upsert = vi.fn(() => ({ select }))
    return { upsert }
}

beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRole = 'admin'
})

describe('upsertService', () => {
    it('rejects non-admin callers', async () => {
        mockRole = 'user'

        const result = await upsertService({ title: 'Styling Session' })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('requires a title and validates the type enum', async () => {
        const missing = await upsertService({ title: '' })
        expect(missing.error).toContain('Title is required')

        const badType = await upsertService({ title: 'Session', type: 'subscription' })
        expect(badType.success).toBe(false)
        expect(badType.error).toContain('Type must be session or retainer')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('strips unknown columns — mass-assignment regression guard', async () => {
        const chain = upsertChain()
        mockWriteFrom.mockReturnValue(chain)

        const result = await upsertService({
            title: 'Styling Session',
            type: 'session',
            active: true,
            unlocks_studio_access: true,
            recommendation_tags: ['color'],
            order_index: 3,
            evil_column: 'x',
        })

        expect(result.success).toBe(true)
        const row = chain.upsert.mock.calls[0][0]
        expect(row).not.toHaveProperty('evil_column')
        expect(row).toMatchObject({
            title: 'Styling Session',
            type: 'session',
            active: true,
            unlocks_studio_access: true,
            recommendation_tags: ['color'],
            order_index: 3,
        })
    })
})

describe('deleteService', () => {
    it('rejects a malformed id before deleting', async () => {
        const result = await deleteService('DROP TABLE services')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Service id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('deletes by a valid id', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom.mockReturnValue({ delete: vi.fn(() => ({ eq })) })

        const result = await deleteService(VALID_UUID)

        expect(result.success).toBe(true)
        expect(eq).toHaveBeenCalledWith('id', VALID_UUID)
    })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/manage-offers.test.ts tests/unit/manage-services.test.ts`
Expected: FAIL — schemas don't exist; current actions pass tampered keys straight through.

- [ ] **Step 3: Write the schemas**

Create `app/lib/validation/offers.ts`:

```ts
import { z } from 'zod';
import { requiredText, optionalTextPreserve, upsertId } from './parse';

/**
 * Upsert payload for `offers`. Absent optional keys stay absent so the upsert
 * only writes columns the form actually sent (the row is built from this
 * schema's output ONLY — that is the mass-assignment fix).
 */
export const offerSchema = z.object({
    id: upsertId('Offer id'),
    slug: requiredText('Slug'),
    title: requiredText('Title'),
    title_es: optionalTextPreserve,
    description: optionalTextPreserve,
    description_es: optionalTextPreserve,
    price_display: optionalTextPreserve,
    price_id: optionalTextPreserve,
    stripe_product_id: optionalTextPreserve,
    active: z.boolean().optional(),
});
```

Create `app/lib/validation/services.ts`:

```ts
import { z } from 'zod';
import { requiredText, optionalTextPreserve, upsertId } from './parse';

/**
 * Upsert payload for `services` (see ServiceForm's dbPayload). Absent optional
 * keys stay absent; the row is built from this schema's output ONLY.
 */
export const serviceSchema = z.object({
    id: upsertId('Service id'),
    title: requiredText('Title'),
    subtitle: optionalTextPreserve,
    description: optionalTextPreserve,
    price_display: optionalTextPreserve,
    price_id: optionalTextPreserve,
    stripe_url: optionalTextPreserve,
    stripe_product_id: optionalTextPreserve,
    image_url: optionalTextPreserve,
    // Mirrors the DB CHECK constraint.
    type: z.preprocess(
        value => (value === '' || value === null ? undefined : value),
        z.enum(['session', 'retainer'], { error: 'Type must be session or retainer' }).optional(),
    ),
    recommendation_tags: z.array(z.string({ error: 'Tags must be text' })).optional(),
    active: z.boolean().optional(),
    order_index: z.preprocess(
        value => (value === '' || value === null ? undefined : value),
        z.coerce.number({ error: 'Order must be a number' }).int('Order must be a whole number').optional(),
    ),
    unlocks_studio_access: z.boolean().optional(),
    title_es: optionalTextPreserve,
    subtitle_es: optionalTextPreserve,
    description_es: optionalTextPreserve,
});
```

- [ ] **Step 4: Rewrite the two actions**

`app/actions/admin/manage-offers.ts` — full new content:

```ts
'use server'

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/app/lib/auth-guards";
import { parseInput } from "@/app/lib/validation/parse";
import { offerSchema } from "@/app/lib/validation/offers";
import { revalidatePath } from "next/cache";

export async function getOffer(slug: string) {
    const supabase = await createClient();
    const { data: offer, error } = await supabase
        .from('offers')
        .select('*')
        .eq('slug', slug)
        .single();

    // It's okay if not found initially
    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching offer:", error);
        return { success: false, error: 'Failed to fetch offer' };
    }

    return { success: true, offer };
}

export async function upsertOffer(offerData: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(offerSchema, offerData);
    if (!parsed.ok) return { success: false, error: parsed.error };

    // Row comes from the schema output only — unknown keys never reach the DB.
    const { error } = await auth.supabase
        .from('offers')
        .upsert(parsed.data)
        .select()
        .single();

    if (error) {
        console.error("Error saving offer:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/foundations', 'page'); // Revalidate potential consumer
    return { success: true };
}
```

`app/actions/admin/manage-services.ts` — full new content:

```ts
'use server'

import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/app/lib/auth-guards";
import { parseInput, uuid } from "@/app/lib/validation/parse";
import { serviceSchema } from "@/app/lib/validation/services";
import { revalidatePath } from "next/cache";

export async function getServices(locale: string = 'en') {
    const supabase = await createClient();

    // Check if user is admin if requesting inactive/all?
    // For now, fetch all active for public, all for admin.
    // Simplifying: fetch all, client can filter. Or separate actions.

    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) {
        console.error("Error fetching services:", error);
        return { success: false, error: 'Failed to fetch services' };
    }

    return { success: true, services };
}

export async function upsertService(serviceData: unknown) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(serviceSchema, serviceData);
    if (!parsed.ok) return { success: false, error: parsed.error };

    // Row comes from the schema output only — unknown keys never reach the DB.
    const { error } = await auth.supabase
        .from('services')
        .upsert(parsed.data)
        .select()
        .single();

    if (error) {
        console.error("Error upserting service:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/services', 'page');
    return { success: true };
}

export async function deleteService(serviceId: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Service id'), serviceId);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase
        .from('services')
        .delete()
        .eq('id', idParsed.data);

    if (error) {
        console.error("Error deleting service:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/services', 'page');
    return { success: true };
}
```

(Note: `getServices`' unused `locale` param stays — signature is public; the old `upsertOffer` "Force slug if new" check is subsumed by `slug: requiredText`, which OfferForm always sends.)

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run tests/unit/manage-offers.test.ts tests/unit/manage-services.test.ts`
Expected: PASS (5 + 5 tests).

- [ ] **Step 6: Commit**

```bash
git add app/lib/validation/offers.ts app/lib/validation/services.ts app/actions/admin/manage-offers.ts app/actions/admin/manage-services.ts tests/unit/manage-offers.test.ts tests/unit/manage-services.test.ts
git commit -m "P1: zod-validate offers/services upserts (mass-assignment fix, requireAdmin)"
```

---

### Task 4: Chapters + masterclasses — FormData validation, safe JSON

**Files:**
- Create: `app/lib/validation/chapters.ts`, `app/lib/validation/masterclasses.ts`
- Modify: `app/actions/admin/manage-chapters.ts`, `app/actions/admin/manage-masterclasses.ts`
- Test: `tests/unit/manage-chapters.test.ts`, `tests/unit/manage-masterclasses.test.ts` (new)

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `chapterSchema` from `@/app/lib/validation/chapters`, `masterclassSchema` from `@/app/lib/validation/masterclasses`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/manage-chapters.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const MASTERCLASS_UUID = '123e4567-e89b-12d3-a456-426614174000'
const CHAPTER_UUID = '223e4567-e89b-12d3-a456-426614174000'

const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'
const mockWriteFrom = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
                }
            }
            return mockWriteFrom(table)
        }),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createChapter, updateChapter } from '@/app/actions/admin/manage-chapters'

function chapterForm(overrides: Record<string, string> = {}) {
    const base: Record<string, string> = {
        slug: 'chapter-1',
        title: 'Chapter One',
        videoId: 'vid123',
        labQuestions: '[]',
        takeaways: '["a"]',
        takeawaysEs: '[]',
        resourceUrls: '[]',
    }
    const fd = new FormData()
    for (const [key, value] of Object.entries({ ...base, ...overrides })) fd.set(key, value)
    return fd
}

function insertChain() {
    const single = vi.fn().mockResolvedValue({ data: { id: CHAPTER_UUID, slug: 'chapter-1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    return { insert }
}

beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRole = 'admin'
})

describe('createChapter', () => {
    it('rejects non-admin callers', async () => {
        mockRole = 'user'

        const result = await createChapter(chapterForm())

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('requires slug, title, and video id with readable errors', async () => {
        const result = await createChapter(chapterForm({ slug: '', title: '', videoId: '' }))

        expect(result.success).toBe(false)
        expect(result.error).toContain('Slug is required')
        expect(result.error).toContain('Title is required')
        expect(result.error).toContain('Video ID is required')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('returns a friendly error instead of throwing on malformed JSON', async () => {
        const result = await createChapter(chapterForm({ takeaways: '{not json' }))

        expect(result.success).toBe(false)
        expect(result.error).toContain('Takeaways contains invalid JSON')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('inserts a fully mapped row and forces is_standalone=false under a masterclass', async () => {
        const chain = insertChain()
        mockWriteFrom.mockReturnValue(chain)

        const result = await createChapter(chapterForm({
            masterclassId: MASTERCLASS_UUID,
            isStandalone: 'true', // must be overridden by the masterclass link
            orderIndex: '4',
        }))

        expect(result.success).toBe(true)
        expect(result.chapter).toEqual({ id: CHAPTER_UUID, slug: 'chapter-1' })
        expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
            slug: 'chapter-1',
            title: 'Chapter One',
            video_id: 'vid123',
            category: 'masterclass',
            order_index: 4,
            masterclass_id: MASTERCLASS_UUID,
            is_standalone: false,
            takeaways: ['a'],
            lab_questions: [],
        }))
    })

    it('keeps the standalone toggle when no masterclass is linked', async () => {
        const chain = insertChain()
        mockWriteFrom.mockReturnValue(chain)

        await createChapter(chapterForm({ isStandalone: 'true' }))

        expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
            masterclass_id: null,
            is_standalone: true,
        }))
    })
})

describe('updateChapter', () => {
    it('rejects a malformed chapter id before writing', async () => {
        const result = await updateChapter('nope', chapterForm())

        expect(result.success).toBe(false)
        expect(result.error).toContain('Chapter id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('updates the row (with updated_at) for valid input', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        const update = vi.fn(() => ({ eq }))
        mockWriteFrom.mockReturnValue({ update })

        const result = await updateChapter(CHAPTER_UUID, chapterForm())

        expect(result.success).toBe(true)
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            slug: 'chapter-1',
            updated_at: expect.any(String),
        }))
        expect(eq).toHaveBeenCalledWith('id', CHAPTER_UUID)
    })
})
```

Create `tests/unit/manage-masterclasses.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const MC_UUID = '123e4567-e89b-12d3-a456-426614174000'

const mockGetUser = vi.fn()
let mockRole: string | null = 'admin'
const mockWriteFrom = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: mockRole }, error: null }),
                }
            }
            return mockWriteFrom(table)
        }),
    })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createMasterclass, updateMasterclass, deleteMasterclass } from '@/app/actions/admin/manage-masterclasses'

function masterclassForm(overrides: Record<string, string> = {}) {
    const base: Record<string, string> = { title: 'Essence 101', orderIndex: '1' }
    const fd = new FormData()
    for (const [key, value] of Object.entries({ ...base, ...overrides })) fd.set(key, value)
    return fd
}

beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRole = 'admin'
})

describe('createMasterclass', () => {
    it('rejects non-admin callers', async () => {
        mockRole = 'user'

        const result = await createMasterclass(masterclassForm())

        expect(result.success).toBe(false)
        expect(result.error).toBe('Forbidden')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('requires a title', async () => {
        const result = await createMasterclass(masterclassForm({ title: '' }))

        expect(result.success).toBe(false)
        expect(result.error).toContain('Title is required')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('inserts the mapped row and returns the created masterclass', async () => {
        const created = { id: MC_UUID, title: 'Essence 101' }
        const single = vi.fn().mockResolvedValue({ data: created, error: null })
        const select = vi.fn(() => ({ single }))
        const insert = vi.fn(() => ({ select }))
        mockWriteFrom.mockReturnValue({ insert })

        const result = await createMasterclass(masterclassForm({ subtitle: '  Sub  ' }))

        expect(result.success).toBe(true)
        expect(result.masterclass).toEqual(created)
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Essence 101',
            subtitle: 'Sub',
            order_index: 1,
        }))
    })
})

describe('updateMasterclass / deleteMasterclass', () => {
    it('updateMasterclass rejects a malformed id', async () => {
        const result = await updateMasterclass('nope', masterclassForm())

        expect(result.success).toBe(false)
        expect(result.error).toContain('Masterclass id is invalid')
        expect(mockWriteFrom).not.toHaveBeenCalled()
    })

    it('deleteMasterclass deletes by a valid id', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null })
        mockWriteFrom.mockReturnValue({ delete: vi.fn(() => ({ eq })) })

        const result = await deleteMasterclass(MC_UUID)

        expect(result.success).toBe(true)
        expect(eq).toHaveBeenCalledWith('id', MC_UUID)
    })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/manage-chapters.test.ts tests/unit/manage-masterclasses.test.ts`
Expected: FAIL — schemas don't exist; malformed-JSON test currently makes the action THROW.

- [ ] **Step 3: Write the schemas**

Create `app/lib/validation/chapters.ts`:

```ts
import { z } from 'zod';
import {
    requiredText,
    optionalText,
    optionalUuid,
    orderIndex,
    jsonArray,
    booleanish,
} from './parse';

/**
 * Chapter payload (fed from the admin form's FormData after key mapping in the
 * action). slug/title/video_id are NOT NULL in the DB; category mirrors the DB
 * CHECK constraint; the jsonb fields accept JSON strings safely.
 */
export const chapterSchema = z
    .object({
        slug: requiredText('Slug'),
        title: requiredText('Title'),
        subtitle: optionalText,
        description: optionalText,
        title_es: optionalText,
        subtitle_es: optionalText,
        description_es: optionalText,
        video_id: requiredText('Video ID'),
        video_id_es: optionalText,
        thumbnail_url: optionalText,
        category: z.preprocess(
            value => value || 'masterclass',
            z.enum(['masterclass', 'course'], { error: 'Category must be masterclass or course' }),
        ),
        order_index: orderIndex,
        masterclass_id: optionalUuid('Masterclass'),
        is_standalone: booleanish,
        lab_questions: jsonArray('Lab questions'),
        takeaways: jsonArray('Takeaways'),
        takeaways_es: jsonArray('Takeaways (Spanish)'),
        resource_urls: jsonArray('Resource URLs'),
        stripe_product_id: optionalText,
        price_id: optionalText,
    })
    // A chapter attached to a masterclass is never standalone.
    .transform(data => ({
        ...data,
        is_standalone: data.masterclass_id ? false : data.is_standalone,
    }));
```

Create `app/lib/validation/masterclasses.ts`:

```ts
import { z } from 'zod';
import { requiredText, optionalText, orderIndex } from './parse';

export const masterclassSchema = z.object({
    title: requiredText('Title'),
    subtitle: optionalText,
    description: optionalText,
    title_es: optionalText,
    subtitle_es: optionalText,
    description_es: optionalText,
    thumbnail_url: optionalText,
    video_url: optionalText,
    order_index: orderIndex,
    stripe_product_id: optionalText,
    price_id: optionalText,
});
```

- [ ] **Step 4: Rewrite the two actions**

`app/actions/admin/manage-chapters.ts` — full new content:

```ts
"use server";

import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/app/lib/auth-guards';
import { parseInput, uuid } from '@/app/lib/validation/parse';
import { chapterSchema } from '@/app/lib/validation/chapters';
import { revalidatePath } from 'next/cache';

// Map the admin form's FormData field names onto DB column names; validation
// and coercion happen in chapterSchema. (Module-private sync helpers are fine
// in a "use server" file — only exports must be async.)
function chapterInput(formData: FormData) {
    return {
        slug: formData.get('slug'),
        title: formData.get('title'),
        subtitle: formData.get('subtitle'),
        description: formData.get('description'),
        title_es: formData.get('titleEs'),
        subtitle_es: formData.get('subtitleEs'),
        description_es: formData.get('descriptionEs'),
        video_id: formData.get('videoId'),
        video_id_es: formData.get('videoIdEs'),
        thumbnail_url: formData.get('thumbnailUrl'),
        category: formData.get('category'),
        order_index: formData.get('orderIndex'),
        masterclass_id: formData.get('masterclassId'),
        is_standalone: formData.get('isStandalone'),
        lab_questions: formData.get('labQuestions'),
        takeaways: formData.get('takeaways'),
        takeaways_es: formData.get('takeawaysEs'),
        resource_urls: formData.get('resourceUrls'),
        stripe_product_id: formData.get('stripeProductId'),
        price_id: formData.get('priceId'),
    };
}

export async function createChapter(formData: FormData) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(chapterSchema, chapterInput(formData));
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { data: chapter, error: chapterError } = await auth.supabase
        .from('chapters')
        .insert(parsed.data)
        .select()
        .single();
    if (chapterError) {
        console.error("Chapter creation error:", chapterError);
        return { success: false, error: chapterError.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');
    revalidatePath(`/vault/foundations/${parsed.data.slug}`);
    revalidatePath(`/${formData.get('locale') || 'en'}/vault/foundations/${parsed.data.slug}`);

    return { success: true, chapter };
}

export async function updateChapter(chapterId: string, formData: FormData) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Chapter id'), chapterId);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(chapterSchema, chapterInput(formData));
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error: chapterError } = await auth.supabase
        .from('chapters')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', idParsed.data);

    if (chapterError) {
        return { success: false, error: chapterError.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');
    revalidatePath(`/vault/foundations/${parsed.data.slug}`);
    revalidatePath(`/${formData.get('locale') || 'en'}/vault/foundations/${parsed.data.slug}`);

    return { success: true };
}

export async function deleteChapter(chapterId: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Chapter id'), chapterId);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase
        .from('chapters')
        .delete()
        .eq('id', idParsed.data);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true };
}

export async function getChapters() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('chapters')
        .select(`
            *,
            masterclasses (
                title
            )
        `)
        .order('order_index', { ascending: true });

    if (error) {
        console.error("Error fetching chapters:", error);
        return { success: false, error: error.message, chapters: [] };
    }

    return { success: true, chapters: data || [] };
}
```

`app/actions/admin/manage-masterclasses.ts` — full new content:

```ts
"use server";

import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/app/lib/auth-guards';
import { parseInput, uuid } from '@/app/lib/validation/parse';
import { masterclassSchema } from '@/app/lib/validation/masterclasses';
import { revalidatePath } from 'next/cache';

// Map the admin form's FormData field names onto DB column names.
function masterclassInput(formData: FormData) {
    return {
        title: formData.get('title'),
        subtitle: formData.get('subtitle'),
        description: formData.get('description'),
        title_es: formData.get('titleEs'),
        subtitle_es: formData.get('subtitleEs'),
        description_es: formData.get('descriptionEs'),
        thumbnail_url: formData.get('thumbnailUrl'),
        video_url: formData.get('videoUrl'),
        order_index: formData.get('orderIndex'),
        stripe_product_id: formData.get('stripeProductId'),
        price_id: formData.get('priceId'),
    };
}

export async function createMasterclass(formData: FormData) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const parsed = parseInput(masterclassSchema, masterclassInput(formData));
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { data, error } = await auth.supabase
        .from('masterclasses')
        .insert(parsed.data)
        .select()
        .single();
    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true, masterclass: data };
}

export async function updateMasterclass(id: string, formData: FormData) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Masterclass id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };
    const parsed = parseInput(masterclassSchema, masterclassInput(formData));
    if (!parsed.ok) return { success: false, error: parsed.error };

    const { error } = await auth.supabase
        .from('masterclasses')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', idParsed.data);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true };
}

export async function deleteMasterclass(id: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const idParsed = parseInput(uuid('Masterclass id'), id);
    if (!idParsed.ok) return { success: false, error: idParsed.error };

    const { error } = await auth.supabase
        .from('masterclasses')
        .delete()
        .eq('id', idParsed.data);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/vault/admin');
    revalidatePath('/vault/foundations');

    return { success: true };
}

export async function getMasterclasses() {
    const supabase = await createClient(); // Public read is allowed via RLS

    const { data, error } = await supabase
        .from('masterclasses')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) {
        return { success: false, error: error.message, masterclasses: [] };
    }

    return { success: true, masterclasses: data };
}
```

(Behavior note: non-admin error strings change from "Unauthorized" to `requireAdmin`'s "Unauthorized"/"Forbidden" split — consistent with the rest of the admin layer.)

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run tests/unit/manage-chapters.test.ts tests/unit/manage-masterclasses.test.ts`
Expected: PASS (7 + 5 tests).

- [ ] **Step 6: Commit**

```bash
git add app/lib/validation/chapters.ts app/lib/validation/masterclasses.ts app/actions/admin/manage-chapters.ts app/actions/admin/manage-masterclasses.ts tests/unit/manage-chapters.test.ts tests/unit/manage-masterclasses.test.ts
git commit -m "P1: zod-validate chapters/masterclasses (safe JSON parsing, requireAdmin)"
```

---

### Task 5: Docs tick-off + full verification

**Files:**
- Modify: `ROADMAP.md` (Phase 1 section), `AUDIT.md` (P2 roadmap line)

- [ ] **Step 1: Full verification**

Run, in order:
1. `npm run test:run` — expected: all tests green (161 prior + ~34 new ≈ 195).
2. `npm run lint` — expected: no NEW errors in the touched files (repo has ~1500 pre-existing `no-explicit-any` errors elsewhere; do not touch them).
3. `npx tsc --noEmit` — expected: clean (strict TS).

- [ ] **Step 2: Update ROADMAP.md**

Change the Phase 1 zod bullet to:

```markdown
- ~~**zod input validation** on server actions~~ — **done (2026-07-10)** for the
  admin write layer: `app/lib/validation/` (parseInput + per-domain schemas),
  the five `manage-*` actions validate at the boundary, mass assignment in the
  offers/services upserts closed, chapter JSON crash path fixed. Broader
  rollout to non-admin actions rides the P2 `any` cleanup.
```

- [ ] **Step 3: Update AUDIT.md**

In the `### P2 — roadmap` paragraph, change `` `zod` input validation `` to:

```markdown
`zod` input validation (admin actions done 2026-07-10, see `app/lib/validation/`)
```

- [ ] **Step 4: Commit**

```bash
git add ROADMAP.md AUDIT.md
git commit -m "Docs: mark admin zod validation done (ROADMAP P1, AUDIT P2 note)"
```

---

## Verification (after all tasks)

- `npm run test:run` fully green; `npm run lint` no new issues; `npx tsc --noEmit` clean.
- Manual spot-check (user, `npm run dev`): in the admin boutique editor, submit a brand with an empty name → toast reads "Please fix the following: Name is required"; submit a valid brand/chapter → still saves; TrustedBy active-toggle and reorder still work (partial updates).
