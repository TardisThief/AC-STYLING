# Wardrobe Storage Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every studio surface identifies a client by `{ wardrobeId, ownerId }`, every upload lands in a policy-checkable folder, guest intake uploads go direct-to-storage, and the `studio-wardrobe` bucket tightens to owner-or-admin.

**Architecture:** A pure path-helper (`lib/wardrobe-paths.ts`) encodes the folder decision; new zod-validated intake actions replace the bytes-through-server-action guest upload; the three studio components swap `clientId` for explicit `{ wardrobeId, ownerId }` props; two SQL migration files (user-applied) fix the lookbooks schema and replace the bucket policy.

**Tech Stack:** Next.js 16 server actions, Supabase (storage RLS, service-role intake), zod (`app/lib/validation/`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-11-wardrobe-storage-normalization-design.md`

## Global Constraints

- Branch: **Dev**. Never merge, deploy, or apply SQL — the user does that.
- DB changes only as reviewable files under `supabase/migrations/` (numbered `20260711_06_*`, `20260711_07_*`) and `scripts/`.
- Action inputs validated with zod at the boundary: `app/lib/validation/<domain>.ts`, `parseInput` from `app/lib/validation/parse` (never schemas inside `"use server"` files). Failures return `{ success: false, error: string }`.
- File bytes must NEVER travel through a server action (Vercel 4.5 MB body cap). Signed-URL direct upload only.
- Keep the Dev suite green (`npm run test:run`, 212 tests + new ones). `npx vitest run <file>` for single files.
- Storage paths: authenticated-owned → `<ownerId>/…`; no owner (guest intake, unassigned wardrobe) → `wardrobe/<id>/…`. No storage objects are ever moved.

---

### Task 1: Path helper `lib/wardrobe-paths.ts`

**Files:**
- Create: `lib/wardrobe-paths.ts`
- Test: `tests/unit/wardrobe-paths.test.ts`

**Interfaces:**
- Produces: `wardrobeStorageFolder(ownerId: string | null, wardrobeId: string): string` and `wardrobeUploadPath(ownerId: string | null, wardrobeId: string, fileName: string, now?: number): string` — used by Tasks 3, 5, 7, 8.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/wardrobe-paths.test.ts
import { describe, it, expect } from 'vitest'
import { wardrobeStorageFolder, wardrobeUploadPath } from '@/lib/wardrobe-paths'

describe('wardrobeStorageFolder', () => {
    it('uses the owner folder when an owner exists', () => {
        expect(wardrobeStorageFolder('user-1', 'ward-1')).toBe('user-1')
    })

    it('falls back to the wardrobe/ prefix when unowned', () => {
        expect(wardrobeStorageFolder(null, 'ward-1')).toBe('wardrobe/ward-1')
    })
})

describe('wardrobeUploadPath', () => {
    it('builds <folder>/<timestamp>-<name>', () => {
        expect(wardrobeUploadPath('user-1', 'ward-1', 'photo.jpg', 1770000000000))
            .toBe('user-1/1770000000000-photo.jpg')
    })

    it('strips path separators and traversal from the file name', () => {
        expect(wardrobeUploadPath(null, 'ward-1', '../a/b.jpg', 1770000000000))
            .toBe('wardrobe/ward-1/1770000000000-_a_b.jpg')
    })

    it('defaults an empty name', () => {
        expect(wardrobeUploadPath('user-1', 'ward-1', '', 1770000000000))
            .toBe('user-1/1770000000000-upload')
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/wardrobe-paths.test.ts`
Expected: FAIL — cannot resolve `@/lib/wardrobe-paths`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/wardrobe-paths.ts
/**
 * Folder convention for the `studio-wardrobe` bucket (see spec
 * 2026-07-11-wardrobe-storage-normalization-design.md):
 *  - owned content lives under `<ownerId>/…` so storage RLS can check
 *    foldername[1] = auth.uid()
 *  - ownerless content (guest intake, unassigned wardrobes) lives under
 *    `wardrobe/<id>/…`, readable by the eventual owner via a wardrobes
 *    subquery in the policy.
 */
export function wardrobeStorageFolder(ownerId: string | null, wardrobeId: string): string {
    return ownerId ? ownerId : `wardrobe/${wardrobeId}`;
}

export function wardrobeUploadPath(
    ownerId: string | null,
    wardrobeId: string,
    fileName: string,
    now: number = Date.now(),
): string {
    const safeName = fileName
        .replace(/[/\\]/g, '_')
        .replace(/\.\./g, '_')
        .slice(0, 100) || 'upload';
    return `${wardrobeStorageFolder(ownerId, wardrobeId)}/${now}-${safeName}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/wardrobe-paths.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/wardrobe-paths.ts tests/unit/wardrobe-paths.test.ts
git commit -m "P1b: add wardrobe storage path helper (owner folder vs wardrobe/ prefix)"
```

---

### Task 2: Migration 06 — lookbooks canvas columns + user_id heal

**Files:**
- Create: `supabase/migrations/20260711_06_lookbooks_canvas_columns.sql`

**Interfaces:**
- Produces: `lookbooks.lookbook_items jsonb`, `lookbooks.thumbnail_url text` — Task 7's component writes depend on these existing once the user applies the migration.

- [ ] **Step 1: Write the migration file**

```sql
-- P1b — Unbreak the lookbook feature.
--
-- DigitalLookbook.tsx reads/writes `lookbook_items` (canvas layout) and
-- `thumbnail_url`, but the live `lookbooks` table has neither column, so
-- every lookbook save fails today. Also heals the one known row where
-- user_id is NULL by copying the owning wardrobe's owner_id (the component
-- used to insert whatever "clientId" it was handed).
--
-- Apply BEFORE deploying the DigitalLookbook changes if possible; the old
-- code fails either way, the new code needs these columns.

ALTER TABLE public.lookbooks
  ADD COLUMN IF NOT EXISTS lookbook_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Heal user_id from the owning wardrobe where missing or dangling.
UPDATE public.lookbooks l
SET user_id = w.owner_id
FROM public.wardrobes w
WHERE l.wardrobe_id = w.id
  AND w.owner_id IS NOT NULL
  AND (l.user_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = l.user_id));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260711_06_lookbooks_canvas_columns.sql
git commit -m "P1b: migration 06 - lookbooks canvas columns + user_id heal (user-applied)"
```

---

### Task 3: Direct-to-storage intake actions

**Files:**
- Create: `app/lib/validation/intake.ts`
- Create: `app/actions/intake.ts`
- Test: `tests/unit/intake.test.ts`

**Interfaces:**
- Consumes: `wardrobeUploadPath` (Task 1), `parseInput`/`requiredText` (`app/lib/validation/parse`).
- Produces: `createIntakeUploadUrl(token: string, fileName: string)` → `{ success: true, path: string, token: string } | { success: false, error: string }`; `createIntakeItem(token: string, filePath: string, note: string)` → `{ success: boolean, error?: string }`. Task 4's component consumes both.

- [ ] **Step 1: Write the validation schema**

```ts
// app/lib/validation/intake.ts
import { z } from 'zod';
import { requiredText } from './parse';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

export const intakeUploadUrlSchema = z.object({
    token: requiredText('Intake token'),
    file_name: requiredText('File name').refine(
        name => ALLOWED_EXTENSIONS.includes(name.split('.').pop()?.toLowerCase() ?? ''),
        'Only JPG, PNG, WEBP, and HEIC files are allowed',
    ),
});

export const intakeItemSchema = z.object({
    token: requiredText('Intake token'),
    // The path our own createIntakeUploadUrl minted: wardrobe/<uuid>/<file>
    file_path: requiredText('File path').refine(
        path => /^wardrobe\/[0-9a-f-]{36}\/[^/]+$/i.test(path),
        'Invalid upload path',
    ),
    note: z.string().max(2000, 'Note is too long').nullish().transform(v => v ?? ''),
});
```

- [ ] **Step 2: Write the failing tests**

```ts
// tests/unit/intake.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockCreateSignedUploadUrl = vi.fn()
const mockInsert = vi.fn()

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        from: mockFrom,
        storage: { from: vi.fn(() => ({ createSignedUploadUrl: mockCreateSignedUploadUrl })) },
    })),
}))

import { createIntakeUploadUrl, createIntakeItem } from '@/app/actions/intake'

const validTokenLookup = () => mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'profile-1' }, error: null }),
})

describe('createIntakeUploadUrl', () => {
    beforeEach(() => vi.clearAllMocks())

    it('mints a signed upload URL under wardrobe/<profileId>/', async () => {
        validTokenLookup()
        mockCreateSignedUploadUrl.mockResolvedValue({
            data: { path: 'wardrobe/profile-1/123-a.jpg', token: 'tok', signedUrl: 'https://x' },
            error: null,
        })

        const res = await createIntakeUploadUrl('tok-1', 'a.jpg')

        expect(res.success).toBe(true)
        expect(mockCreateSignedUploadUrl.mock.calls[0][0]).toMatch(/^wardrobe\/profile-1\/\d+-a\.jpg$/)
    })

    it('rejects an invalid token without touching storage', async () => {
        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } }),
        })

        const res = await createIntakeUploadUrl('bad', 'a.jpg')

        expect(res.success).toBe(false)
        expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled()
    })

    it('rejects disallowed file extensions', async () => {
        const res = await createIntakeUploadUrl('tok-1', 'malware.exe')
        expect(res.success).toBe(false)
        expect(res.error).toMatch(/JPG, PNG, WEBP/i)
    })
})

describe('createIntakeItem', () => {
    beforeEach(() => vi.clearAllMocks())

    it('inserts an inbox wardrobe_items row for the invite profile', async () => {
        const single = vi.fn().mockResolvedValue({ data: { id: 'profile-1' }, error: null })
        mockInsert.mockResolvedValue({ error: null })
        mockFrom.mockImplementation((table: string) => table === 'profiles'
            ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single }
            : { insert: mockInsert })

        const res = await createIntakeItem('tok-1', 'wardrobe/2b7e1c1e-0000-4000-8000-000000000000/1-a.jpg', 'my note')

        expect(res.success).toBe(true)
        expect(mockInsert.mock.calls[0][0]).toMatchObject({
            user_id: 'profile-1',
            status: 'inbox',
            client_note: 'my note',
        })
    })

    it('rejects a path outside wardrobe/<uuid>/', async () => {
        const res = await createIntakeItem('tok-1', 'someone-else/1-a.jpg', '')
        expect(res.success).toBe(false)
    })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/intake.test.ts`
Expected: FAIL — cannot resolve `@/app/actions/intake`

- [ ] **Step 4: Write the actions**

```ts
// app/actions/intake.ts
"use server";

import { parseInput } from '@/app/lib/validation/parse';
import { intakeUploadUrlSchema, intakeItemSchema } from '@/app/lib/validation/intake';
import { wardrobeUploadPath } from '@/lib/wardrobe-paths';

/**
 * Guest wardrobe intake, direct-to-storage. File bytes must not pass through
 * a server action (Vercel caps request bodies at 4.5 MB), so the browser
 * uploads via a signed URL and these actions only validate the intake token
 * (service role — guests have no session) and record the result.
 */

async function findInviteProfile(token: string) {
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('intake_token', token)
        .single();
    if (error || !data) return { supabase, profile: null };
    return { supabase, profile: data };
}

export async function createIntakeUploadUrl(token: string, fileName: string) {
    const parsed = parseInput(intakeUploadUrlSchema, { token, file_name: fileName });
    if (!parsed.ok) return { success: false as const, error: parsed.error };

    const { supabase, profile } = await findInviteProfile(parsed.data.token);
    if (!profile) return { success: false as const, error: 'Invalid or expired intake token.' };

    const path = wardrobeUploadPath(null, profile.id, parsed.data.file_name);
    const { data, error } = await supabase.storage
        .from('studio-wardrobe')
        .createSignedUploadUrl(path);

    if (error || !data) {
        return { success: false as const, error: error?.message || 'Could not authorize upload' };
    }
    return { success: true as const, path: data.path, token: data.token };
}

export async function createIntakeItem(token: string, filePath: string, note: string) {
    const parsed = parseInput(intakeItemSchema, { token, file_path: filePath, note });
    if (!parsed.ok) return { success: false as const, error: parsed.error };

    const { supabase, profile } = await findInviteProfile(parsed.data.token);
    if (!profile) return { success: false as const, error: 'Invalid or expired intake token.' };

    // Only accept paths in this profile's own intake folder.
    if (!parsed.data.file_path.startsWith(`wardrobe/${profile.id}/`)) {
        return { success: false as const, error: 'Invalid upload path' };
    }

    const { data: { publicUrl } } = supabase.storage
        .from('studio-wardrobe')
        .getPublicUrl(parsed.data.file_path);

    const { error } = await supabase.from('wardrobe_items').insert({
        user_id: profile.id,
        image_url: publicUrl,
        client_note: parsed.data.note,
        status: 'inbox',
    });

    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
}
```

Note: `wardrobeUploadPath(null, profile.id, …)` produces `wardrobe/<profileId>/…` — the same convention `uploadGuestWardrobeItem` used, so admin inbox review and post-signup owner reads keep working. The item-path check plus the schema regex means a token holder can only register files in their own folder.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/intake.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add app/lib/validation/intake.ts app/actions/intake.ts tests/unit/intake.test.ts
git commit -m "P1b: zod-validated direct-to-storage guest intake actions"
```

---

### Task 4: IntakeUploader uses the direct-upload actions

**Files:**
- Modify: `components/studio/IntakeUploader.tsx` (guest branch of `handleUploadAll`, lines ~70-99; auth branch upload path, lines ~123-127)
- Modify: `app/actions/studio.ts` (delete `uploadGuestWardrobeItem`, lines 259-331)

**Interfaces:**
- Consumes: `createIntakeUploadUrl` / `createIntakeItem` (Task 3), `wardrobeUploadPath` (Task 1), browser client `createClient` from `@/utils/supabase/client`.

- [ ] **Step 1: Replace the guest branch**

In `components/studio/IntakeUploader.tsx`, replace the import of `uploadGuestWardrobeItem`:

```ts
import { createIntakeUploadUrl, createIntakeItem } from "@/app/actions/intake";
import { getMyWardrobe } from "@/app/actions/wardrobes";
import { wardrobeUploadPath } from "@/lib/wardrobe-paths";

const MAX_INTAKE_BYTES = 20 * 1024 * 1024; // was enforced server-side where Vercel's 4.5MB cap hit first
```

Replace the guest loop body (the FormData + `uploadGuestWardrobeItem` block):

```ts
for (let i = 0; i < files.length; i++) {
    const entry = files[i];
    if (entry.status === 'success') continue;

    if (entry.file.size > MAX_INTAKE_BYTES) {
        throw new Error(`"${entry.file.name}" is too large (max 20MB).`);
    }

    setFiles(prev => {
        const next = [...prev];
        next[i].status = 'uploading';
        return next;
    });

    const authorized = await createIntakeUploadUrl(token, entry.file.name);
    if (!authorized.success) throw new Error(authorized.error);

    const { error: uploadError } = await supabase.storage
        .from('studio-wardrobe')
        .uploadToSignedUrl(authorized.path, authorized.token, entry.file);
    if (uploadError) throw new Error(uploadError.message);

    const recorded = await createIntakeItem(token, authorized.path, entry.note);
    if (!recorded.success) throw new Error(recorded.error);

    setFiles(prev => {
        const next = [...prev];
        next[i].status = 'success';
        return next;
    });
}
```

- [ ] **Step 2: Normalize the authenticated branch's path**

In the auth branch, replace the two `filePath` lines (`wardrobe/${user.id}/…` construction):

```ts
const filePath = wardrobeUploadPath(user.id, wardrobe.id, entry.file.name);
```

(Authenticated clients now upload to `<user_id>/…` — checkable by the owner policy clause. The insert already sets both `user_id` and `wardrobe_id`; keep it.)

- [ ] **Step 3: Delete `uploadGuestWardrobeItem` from `app/actions/studio.ts`**

Remove the whole function (lines 259-331). `IntakeUploader` was its only caller (verified by grep 2026-07-11).

- [ ] **Step 4: Run the suite**

Run: `npm run test:run`
Expected: all green (no test imports `uploadGuestWardrobeItem`)

- [ ] **Step 5: Commit**

```bash
git add components/studio/IntakeUploader.tsx app/actions/studio.ts
git commit -m "P1b: guest intake uploads direct to storage (drop 4.5MB server-action cap)"
```

---

### Task 5: VirtualWardrobe ownership contract

**Files:**
- Modify: `components/studio/VirtualWardrobe.tsx`
- Modify: `components/studio/StudioDashboard.tsx:318`
- Modify: `components/studio/ClientStudioDashboard.tsx`
- Modify: `app/[locale]/vault/my-studio/page.tsx`

**Interfaces:**
- Consumes: `wardrobeUploadPath` (Task 1), `getMyWardrobe` (`app/actions/wardrobes.ts`, existing).
- Produces: `VirtualWardrobeProps { wardrobeId: string; ownerId: string | null; isClientView?: boolean }`; `ClientStudioDashboardProps { wardrobeId: string; ownerId: string; initialMeasurements: any; userName: string }`. Task 6/7 reuse the same dashboard wiring pattern.

- [ ] **Step 1: Change the props and queries**

```ts
interface VirtualWardrobeProps {
    wardrobeId: string;
    ownerId: string | null; // null = unassigned wardrobe (stylist-only)
    isClientView?: boolean;
}

export default function VirtualWardrobe({ wardrobeId, ownerId, isClientView = false }: VirtualWardrobeProps) {
```

- Item query (line ~55) stays `.eq('wardrobe_id', wardrobeId)` — now correct from BOTH entry points.
- Clone-target exclusion (line ~70): `.neq('id', ownerId ?? '')`.
- `useEffect` deps: `[wardrobeId, ownerId, supabase, isClientView]`.

- [ ] **Step 2: Fix all three inserts to set both ids**

Boutique import (line ~520), file upload (line ~610), link add (line ~768) each get:

```ts
user_id: ownerId,
wardrobe_id: wardrobeId,
```

Clone note (line ~122): `Cloned from wardrobe ${wardrobeId}. …`.

- [ ] **Step 3: Route uploads through the helper**

File upload (~599) and update-image upload (~871): replace both `` `${clientId}/${fileName}` `` path pairs with a single computed path:

```ts
const path = wardrobeUploadPath(ownerId, wardrobeId, uploadFile.name);
const { error: uploadError } = await supabase.storage.from('studio-wardrobe').upload(path, uploadFile);
// …
const { data: { publicUrl } } = supabase.storage.from('studio-wardrobe').getPublicUrl(path);
```

(same shape with `updateFile.name` in the update modal).

- [ ] **Step 4: Link import only secures the image for owned wardrobes**

Replace the `uploadRemoteImage(linkForm.imageUrl, clientId)` call (line ~754):

```ts
if (ownerId) {
    const uploadRes = await uploadRemoteImage(linkForm.imageUrl, ownerId);
    if (uploadRes.success && uploadRes.url) finalImageUrl = uploadRes.url;
    else toast.warning("Could not save image locally. Using external link.");
} else {
    toast.info("Unassigned wardrobe — storing the external image link.");
}
```

(`uploadRemoteImage` keeps its existing `(imageUrl, userId)` signature; it already targets `<userId>/…`.)

- [ ] **Step 5: Wire the entry points**

`StudioDashboard.tsx:318`:

```tsx
{activeTab === 'wardrobe' && <VirtualWardrobe wardrobeId={selectedWardrobe.id} ownerId={selectedWardrobe.owner_id ?? null} />}
```

`app/[locale]/vault/my-studio/page.tsx` — fetch the wardrobe server-side:

```tsx
import { getMyWardrobe } from "@/app/actions/wardrobes";
// after the user/profile fetch:
const { wardrobe } = await getMyWardrobe();
if (!wardrobe) redirect('/vault');
return (
    <ClientStudioDashboard
        wardrobeId={wardrobe.id}
        ownerId={user.id}
        initialMeasurements={tailorCard?.measurements}
        userName={profile.full_name?.split(' ')[0] || "Client"}
    />
);
```

`ClientStudioDashboard.tsx` — props become `{ wardrobeId, ownerId, initialMeasurements, userName }`; pass `wardrobeId={wardrobeId} ownerId={ownerId}` to `VirtualWardrobe`, keep `clientId={ownerId}` for `DigitalLookbook` (until Task 7) and `userId={ownerId}` for `TailorCardUser`.

- [ ] **Step 6: Run the suite**

Run: `npm run test:run`
Expected: green (components have no direct unit tests; the suite guards the actions they call)

- [ ] **Step 7: Commit**

```bash
git add components/studio/VirtualWardrobe.tsx components/studio/StudioDashboard.tsx components/studio/ClientStudioDashboard.tsx "app/[locale]/vault/my-studio/page.tsx"
git commit -m "P1b: VirtualWardrobe keys on {wardrobeId, ownerId}; fixes corrupt user_id inserts and empty client view"
```

---

### Task 6: TailorCard contract

**Files:**
- Modify: `components/studio/TailorCard.tsx`
- Modify: `components/studio/StudioDashboard.tsx:317`

**Interfaces:**
- Consumes: dashboard wiring pattern from Task 5.

- [ ] **Step 1: Replace props and drop the internal wardrobe lookup**

```ts
interface TailorCardProps {
    wardrobeId: string;        // kept for parity/logging; not queried
    ownerId: string | null;
}

export default function TailorCard({ ownerId: ownerIdProp }: TailorCardProps) {
```

Delete the `wardrobes` lookup in `loadData` (lines 35-47); start from `const ownerId = ownerIdProp;` and keep the existing empty-state branch for `!ownerId` and the three profile-keyed fetches. `useEffect` deps become `[ownerIdProp, supabase]`. The `handleUpdate`/`toggleActiveStatus` guards on `ownerId` stay as-is (state var now seeded from the prop).

- [ ] **Step 2: Wire the dashboard**

`StudioDashboard.tsx:317`:

```tsx
{activeTab === 'tailor' && <TailorCard wardrobeId={selectedWardrobe.id} ownerId={selectedWardrobe.owner_id ?? null} />}
```

- [ ] **Step 3: Run the suite, commit**

Run: `npm run test:run` → green.

```bash
git add components/studio/TailorCard.tsx components/studio/StudioDashboard.tsx
git commit -m "P1b: TailorCard takes explicit ownerId (drops wardrobe->owner lookup)"
```

---

### Task 7: DigitalLookbook contract + working thumbnails

**Files:**
- Modify: `components/studio/DigitalLookbook.tsx`
- Modify: `components/studio/StudioDashboard.tsx:319`
- Modify: `components/studio/ClientStudioDashboard.tsx` (line ~70)

**Interfaces:**
- Consumes: `wardrobeUploadPath` (Task 1); migration 06 columns (`lookbook_items`, `thumbnail_url`); `signWardrobeItems` (existing).

- [ ] **Step 1: Props and queries**

```ts
interface DigitalLookbookProps {
    wardrobeId: string;
    ownerId: string | null;
    isClientView?: boolean;
}
```

`loadData`: lookbooks by `.eq('wardrobe_id', wardrobeId)`; wardrobe items by `.eq('wardrobe_id', wardrobeId)`. `handleCreateLookbook` insert:

```ts
user_id: ownerId,
wardrobe_id: wardrobeId,
title: newTitle,
collection_name: newCollection,
status: 'Draft',
lookbook_items: []
```

- [ ] **Step 2: Thumbnails into studio-wardrobe, errors surfaced**

Replace the `lookbooks`-bucket block in `handleSaveLookbook` (lines ~101-104):

```ts
const thumbPath = wardrobeUploadPath(ownerId, wardrobeId, `lookbook-thumbs/thumb_${activeLookbook.id}.jpg`);
const { error: thumbError } = await supabase.storage
    .from('studio-wardrobe')
    .upload(thumbPath, blob, { upsert: false });
if (thumbError) {
    toast.warning("Lookbook saved, but the thumbnail could not be updated.");
} else {
    thumbnailUrl = supabase.storage.from('studio-wardrobe').getPublicUrl(thumbPath).data.publicUrl;
}
```

Note: `wardrobeUploadPath` sanitizes `/` in the name segment, so `lookbook-thumbs/thumb_x.jpg` becomes `…/lookbook-thumbs_thumb_<id>.jpg` — a flat file inside the owner folder. That keeps the spec's intent (owner-scoped, signable) with the existing helper; no subfolder needed.

- [ ] **Step 3: Wire both dashboards**

`StudioDashboard.tsx:319`:

```tsx
{activeTab === 'lookbook' && <DigitalLookbook wardrobeId={selectedWardrobe.id} ownerId={selectedWardrobe.owner_id ?? null} />}
```

`ClientStudioDashboard.tsx` line ~70:

```tsx
<DigitalLookbook wardrobeId={wardrobeId} ownerId={ownerId} isClientView={true} />
```

- [ ] **Step 4: Run the suite, commit**

Run: `npm run test:run` → green.

```bash
git add components/studio/DigitalLookbook.tsx components/studio/StudioDashboard.tsx components/studio/ClientStudioDashboard.tsx
git commit -m "P1b: DigitalLookbook keys on {wardrobeId, ownerId}; thumbnails to studio-wardrobe with surfaced errors"
```

---

### Task 8: GatedWardrobe sets wardrobe_id and uses the helper

**Files:**
- Modify: `components/vault/GatedWardrobe.tsx` (`handleUpload`, lines ~66-90)

**Interfaces:**
- Consumes: `wardrobeUploadPath` (Task 1), `getMyWardrobe` (existing).

- [ ] **Step 1: Update handleUpload**

```ts
const handleUpload = async () => {
    if (!uploadFile) return toast.error("Please select a photo.");
    setIsSaving(true);
    try {
        const { wardrobe } = await getMyWardrobe();
        if (!wardrobe) throw new Error("Could not access your wardrobe.");

        const path = wardrobeUploadPath(userId, wardrobe.id, uploadFile.name);
        const { error: uploadError } = await supabase.storage
            .from('studio-wardrobe')
            .upload(path, uploadFile);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('studio-wardrobe')
            .getPublicUrl(path);

        const { data: newItem, error: dbError } = await supabase.from('wardrobe_items').insert({
            user_id: userId,
            wardrobe_id: wardrobe.id,
            image_url: publicUrl,
            client_note: clientNote,
            status: 'Keep',
            category: category || 'Uncategorized'
        }).select().single();
        // …rest unchanged
```

(add `import { getMyWardrobe } from "@/app/actions/wardrobes";` and `import { wardrobeUploadPath } from "@/lib/wardrobe-paths";`)

- [ ] **Step 2: Run the suite, commit**

Run: `npm run test:run` → green.

```bash
git add components/vault/GatedWardrobe.tsx
git commit -m "P1b: GatedWardrobe uploads via path helper and links items to the wardrobe"
```

---

### Task 9: Migration 07 — owner-or-admin bucket policy

**Files:**
- Create: `supabase/migrations/20260711_07_owner_scope_studio_wardrobe.sql`

- [ ] **Step 1: Write the migration**

```sql
-- P1b — Tighten `studio-wardrobe` from authenticated-only to owner-or-admin.
--
-- Folder convention (lib/wardrobe-paths.ts, spec 2026-07-11):
--   <user_id>/…              owned content, checked against auth.uid()
--   wardrobe/<user_id>/…     guest intake for an invite profile
--   wardrobe/<wardrobe_id>/… token intake / unassigned wardrobes,
--                            readable by the wardrobe's eventual owner
--
-- ┌─ COORDINATION ──────────────────────────────────────────────────────────┐
-- │ Deploy the P1b code FIRST (all writes use the convention above), then   │
-- │ apply this. Service-role intake paths bypass RLS and are unaffected.    │
-- │ Verify with scripts/verify_wardrobe_policy.ts afterwards.               │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.can_access_wardrobe_object(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT
    (storage.foldername(object_name))[1] = auth.uid()::text
    OR (
      (storage.foldername(object_name))[1] = 'wardrobe'
      AND (
        (storage.foldername(object_name))[2] = auth.uid()::text
        OR (storage.foldername(object_name))[2] IN (
          SELECT id::text FROM public.wardrobes WHERE owner_id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    );
$$;

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_read" ON storage.objects;
CREATE POLICY "studio_wardrobe_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'studio-wardrobe' AND public.can_access_wardrobe_object(name));

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_insert" ON storage.objects;
CREATE POLICY "studio_wardrobe_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-wardrobe' AND public.can_access_wardrobe_object(name));

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_update" ON storage.objects;
CREATE POLICY "studio_wardrobe_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-wardrobe' AND public.can_access_wardrobe_object(name));

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_delete" ON storage.objects;
CREATE POLICY "studio_wardrobe_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'studio-wardrobe' AND public.can_access_wardrobe_object(name));

-- Legacy per-owner policies from the original schema are superseded:
DROP POLICY IF EXISTS "Owner Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete Access" ON storage.objects;
```

(The helper function keeps the four policies identical and readable; `SECURITY DEFINER` lets it read `wardrobes`/`profiles` regardless of the caller's row visibility, matching how the existing admin checks behave.)

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260711_07_owner_scope_studio_wardrobe.sql
git commit -m "P1b: migration 07 - owner-or-admin studio-wardrobe policy (user-applied)"
```

---

### Task 10: Verification + cleanup scripts

**Files:**
- Create: `scripts/verify_wardrobe_policy.ts`
- Create: `scripts/cleanup_orphaned_wardrobe_files.ts`

Both follow the `scripts/debug-db-state.ts` pattern: `dotenv` from `.env.local`, run with `NODE_PATH=./node_modules npx tsx scripts/<file>.ts`. They are user-run tools, not part of the test suite.

- [ ] **Step 1: Policy verification script**

```ts
// scripts/verify_wardrobe_policy.ts
// Run AFTER applying migration 07. Asserts the owner-or-admin matrix using
// SET LOCAL role + request.jwt.claims to simulate callers against
// public.can_access_wardrobe_object.
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkAs(c: Client, userId: string, objectName: string): Promise<boolean> {
    await c.query('BEGIN');
    await c.query(`SET LOCAL role authenticated`);
    await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    const r = await c.query('SELECT public.can_access_wardrobe_object($1) AS ok', [objectName]);
    await c.query('ROLLBACK');
    return r.rows[0].ok === true;
}

async function main() {
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();

    const { rows: [w] } = await c.query(
        `SELECT id, owner_id FROM public.wardrobes WHERE owner_id IS NOT NULL LIMIT 1`);
    const { rows: [admin] } = await c.query(
        `SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1`);
    const { rows: [stranger] } = await c.query(
        `SELECT id FROM public.profiles WHERE role <> 'admin' AND id <> $1 LIMIT 1`, [w.owner_id]);

    const cases: Array<[string, string, string, boolean]> = [
        ['owner reads own folder',        w.owner_id,  `${w.owner_id}/x.jpg`,        true],
        ['owner reads owned wardrobe/',   w.owner_id,  `wardrobe/${w.id}/x.jpg`,     true],
        ['owner reads own intake folder', w.owner_id,  `wardrobe/${w.owner_id}/x.jpg`, true],
        ['stranger blocked from folder',  stranger?.id, `${w.owner_id}/x.jpg`,       false],
        ['stranger blocked from wardrobe/', stranger?.id, `wardrobe/${w.id}/x.jpg`,  false],
        ['admin reads anything',          admin.id,    `${w.owner_id}/x.jpg`,        true],
    ];

    let failed = 0;
    for (const [label, uid, obj, expected] of cases) {
        if (!uid) { console.log(`SKIP ${label} (no such user)`); continue; }
        const ok = await checkAs(c, uid, obj);
        const pass = ok === expected;
        if (!pass) failed++;
        console.log(`${pass ? 'PASS' : 'FAIL'} ${label} (got ${ok}, expected ${expected})`);
    }
    await c.end();
    process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Orphan cleanup script (dry-run by default)**

```ts
// scripts/cleanup_orphaned_wardrobe_files.ts
// Lists studio-wardrobe objects whose folder maps to no live profile or
// wardrobe AND that no wardrobe_items.image_url / lookbooks.thumbnail_url
// references. Dry-run by default; pass --delete to remove them.
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const doDelete = process.argv.includes('--delete');
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();

    const { rows } = await c.query(`
        SELECT o.name
        FROM storage.objects o
        WHERE o.bucket_id = 'studio-wardrobe'
          -- folder maps to nothing live (either bare or wardrobe/-prefixed)
          AND NOT EXISTS (SELECT 1 FROM public.profiles p
              WHERE p.id::text IN ((storage.foldername(o.name))[1], (storage.foldername(o.name))[2]))
          AND NOT EXISTS (SELECT 1 FROM public.wardrobes w
              WHERE w.id::text IN ((storage.foldername(o.name))[1], (storage.foldername(o.name))[2]))
          -- and nothing references the file
          AND NOT EXISTS (SELECT 1 FROM public.wardrobe_items wi
              WHERE wi.image_url LIKE '%' || o.name)
          AND NOT EXISTS (SELECT 1 FROM public.lookbooks l
              WHERE l.thumbnail_url LIKE '%' || o.name)
        ORDER BY o.name
    `);

    console.log(`${rows.length} orphaned object(s):`);
    rows.forEach(r => console.log('  ' + r.name));

    if (!doDelete) {
        console.log('\nDry run. Re-run with --delete to remove them.');
    } else if (rows.length) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        const { error } = await supabase.storage
            .from('studio-wardrobe')
            .remove(rows.map(r => r.name));
        if (error) throw error;
        console.log('Deleted.');
    }
    await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Commit**

```bash
git add scripts/verify_wardrobe_policy.ts scripts/cleanup_orphaned_wardrobe_files.ts
git commit -m "P1b: policy verification + orphan cleanup scripts (user-run)"
```

---

### Task 11: Docs + full verification

**Files:**
- Modify: `ROADMAP.md` (mark P1b code-complete, note migrations 06/07 pending user apply)
- Modify: `AUDIT.md` (P2 wardrobe-folder note → resolved-in-code, pending SQL)
- Modify: `CLAUDE.md` (one line in Architecture & conventions: wardrobe uploads go through `lib/wardrobe-paths.ts`; studio components take `{ wardrobeId, ownerId }`)

- [ ] **Step 1: Update the three docs** (wording at implementer's discretion, one short paragraph each; convert relative dates to absolute: code-complete 2026-07-11)

- [ ] **Step 2: Full verification**

Run: `npm run test:run` → all green (expect 212 + ~12 new)
Run: `npm run lint` → no NEW errors in touched files (repo has known pre-existing debt; compare against `git stash`-baseline if unsure)
Run: `npm run build` → exit 0

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md AUDIT.md CLAUDE.md
git commit -m "P1b: docs - wardrobe storage normalization code-complete (migrations pending apply)"
```

---

## Self-Review Notes

- **Spec coverage:** ownership contract → Tasks 5-7; path convention → Tasks 1, 4, 5, 7, 8; guest intake direct upload → Tasks 3-4; migrations → Tasks 2, 9; scripts → Task 10; error handling (lookbook thumbnail) → Task 7; rollout docs → Task 11. E2E: spec says no changes needed.
- **Deliberate deviations from spec, all narrowing:** (1) `uploadRemoteImage` keeps its signature — callers now pass a real owner id, unassigned wardrobes store the external link (spec's table only required owned-upload behavior); (2) lookbook thumbs land as `<ownerId>/lookbook-thumbs_thumb_<id>.jpg` (flat, sanitized) rather than a subfolder — same policy scope.
- **Type consistency:** `wardrobeUploadPath(ownerId: string | null, wardrobeId: string, fileName: string, now?: number)` used identically in Tasks 3, 4, 5, 7, 8. Intake action return shapes match between Task 3 code and Task 4 consumption.
