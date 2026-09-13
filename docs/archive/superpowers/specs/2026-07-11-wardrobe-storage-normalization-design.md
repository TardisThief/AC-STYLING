# Wardrobe Storage Normalization — Design

**Date:** 2026-07-11
**Status:** Approved (pending user spec review)
**Roadmap:** P1b — normalize wardrobe storage folder convention, then tighten migration 03's RLS
**Related:** AUDIT.md P2 note; `supabase/migrations/20260710_03_lock_studio_wardrobe_bucket.sql` (owner-scoping stub in its footer)

## Problem

The `studio-wardrobe` bucket holds client wardrobe photos under four different
folder conventions, because `clientId` means a **user id** in some entry points
and a **wardrobe id** in others:

| Writer | Path written | `clientId` means |
|---|---|---|
| `components/studio/VirtualWardrobe.tsx` | `<clientId>/…` | wardrobe_id (StudioDashboard) or user_id (my-studio) |
| `components/vault/GatedWardrobe.tsx`, `uploadRemoteImage` (`app/actions/studio.ts`) | `<user_id>/…` | user_id |
| Token intake (`app/actions/wardrobes.ts` `getSignedUploadUrl`) | `wardrobe/<wardrobe_id>/…` | n/a (service role) |
| Guest intake (`uploadGuestWardrobeItem`), `IntakeUploader.tsx` auth branch | `wardrobe/<profile_id>/…` | n/a / user_id |

Because no single folder rule exists, migration 03 had to leave the bucket
policy at authenticated-only: **any logged-in member can sign URLs for any
client's photos**. Tightening it is the point of this work.

### Confirmed live bugs (beyond the folder mess)

1. `VirtualWardrobe` inserts `user_id: clientId` with **no `wardrobe_id`**.
   From the stylist dashboard that writes a wardrobe UUID into `user_id`
   (`wardrobe_items.user_id` has no FK, so it lands).
2. `VirtualWardrobe` lists items with `wardrobe_id = clientId`, but my-studio
   passes `user.id` — a client's own wardrobe tab queries
   `wardrobe_id = <user_id>` and shows **nothing**.
3. `DigitalLookbook` has the same disease (`user_id = <wardrobe uuid>` on
   insert from the dashboard; client view queries by real user_id and misses),
   **and** writes `lookbook_items` / `thumbnail_url` columns that don't exist
   in the live `lookbooks` table, **and** uploads thumbnails to a `lookbooks`
   bucket that doesn't exist. The lookbook feature is broken today.
4. `uploadGuestWardrobeItem` sends file bytes through a server action —
   Vercel caps request bodies at 4.5 MB, so a new client's phone photos fail
   on production despite the action's own 20 MB check (same failure class as
   the 2026-07-11 vault-assets fix on main).

### Live data (queried 2026-07-11)

46 objects in `studio-wardrobe`: 44 orphans under `wardrobe/<deleted ids>/`,
2 real files under `wardrobe/<wardrobe_id>/` referenced by the only 2
`wardrobe_items` rows (both healthy). 2 wardrobes, both owned. Nothing exists
under bare `<user_id>/` or `<wardrobe_id>/` folders. Data migration burden is
effectively zero.

## Decision (Approach A)

**User_id-first writes, dual-clause owner-or-admin policy, zero file moves.**

Rejected alternatives:
- **Full path migration** (everything under `<user_id>/…`, move files on
  claim/assign): intake runs unauthenticated via service role and can never
  satisfy an `auth.uid()` folder check at write time, so `wardrobe/…` remains
  a live convention regardless — the move-on-claim machinery would exist to
  serve 2 files. Not worth the failure modes.
- **Minimal bugfix** (fix inserts, keep authenticated-only policy): doesn't
  achieve the security goal.

## 1. Ownership contract

`VirtualWardrobe`, `TailorCard`, and `DigitalLookbook` replace
`clientId: string` with:

```ts
interface StudioClientProps {
    wardrobeId: string;
    ownerId: string | null; // null = unassigned wardrobe (stylist-only state)
}
```

- **StudioDashboard** passes `wardrobeId={selectedWardrobe.id}`
  `ownerId={selectedWardrobe.owner_id}` (`getWardrobes` already joins owner).
- **my-studio / ClientStudioDashboard** calls `getMyWardrobe()` server-side
  (auto-creates on first visit) and passes `wardrobeId={wardrobe.id}`
  `ownerId={user.id}`.
- Item **queries** filter `wardrobe_id = wardrobeId`.
- Item **inserts** set both `wardrobe_id: wardrobeId` and `user_id: ownerId`.
- `TailorCard` drops its internal wardrobe→owner lookup; props provide it.
- `GatedWardrobe` also sets `wardrobe_id` on insert via `getMyWardrobe()`.
- Cross-client clone in `VirtualWardrobe` keeps its explicit target-profile
  picker (target user's own wardrobe id resolved at clone time).

This is also the enabler for the P4 "tailored content from Lab answers" idea:
every studio surface keys on a real `user_id`, so joining
`essence_responses → user_id → studio data` needs no further refactoring.
Building any of that is a non-goal here.

## 2. Storage path convention

| Flow | Path | Rationale |
|---|---|---|
| Authenticated uploads (VirtualWardrobe, GatedWardrobe, IntakeUploader auth branch, uploadRemoteImage) | `<ownerId>/<file>` | Owner check is `foldername[1] = auth.uid()` |
| Stylist upload into an **unassigned** wardrobe (`ownerId === null`) | `wardrobe/<wardrobeId>/<file>` | No owner yet; admin-writable, becomes owner-readable on assignment |
| Token intake (WardrobeUploadLanding) | `wardrobe/<wardrobeId>/<file>` — unchanged | Guest has no auth.uid(); service role signs |
| Guest intake (IntakeUploader guest branch) | `wardrobe/<profileId>/<file>` — unchanged path, new transport | Same |
| Lookbook thumbnails | `<ownerId>/lookbook-thumbs/<file>` in **studio-wardrobe** | Reuses bucket, policy, `signWardrobeItems`; no new bucket |

A shared helper `lib/wardrobe-paths.ts` encodes the decision so components
never hand-build paths:

```ts
wardrobeStorageFolder(ownerId, wardrobeId)
// ownerId set  → `${ownerId}`
// ownerId null → `wardrobe/${wardrobeId}`
```

**No storage objects are ever moved.** The 2 legacy files stay readable
through the `wardrobe/` policy clause.

## 3. Guest intake goes direct-to-storage

`uploadGuestWardrobeItem(formData, token)` is replaced by the two-step pattern
`WardrobeUploadLanding` already proves out:

1. `createIntakeUploadUrl(token, fileName)` — server action, service role:
   validates `intake_token` → returns signed upload URL + path
   `wardrobe/<profileId>/<unique>.<ext>`; enforces extension/type allowlist.
2. Browser `uploadToSignedUrl(path, token, file)` — full resolution, no
   Vercel body cap. 20 MB check runs client-side where it can actually run.
3. `createIntakeItem(token, filePath, note)` — server action, service role:
   re-validates token, inserts the `wardrobe_items` row (`status: 'inbox'`).

`uploadGuestWardrobeItem` is deleted (IntakeUploader is its only caller).

## 4. Database changes (files only — the user applies all SQL)

- **`supabase/migrations/20260711_06_lookbooks_canvas_columns.sql`**
  `ALTER TABLE lookbooks ADD COLUMN lookbook_items jsonb DEFAULT '[]',
  ADD COLUMN thumbnail_url text;` (IF NOT EXISTS guards; unblocks lookbooks).
- **`supabase/migrations/20260711_07_owner_scope_studio_wardrobe.sql`**
  Replaces the four `studio_wardrobe_authenticated_*` policies with
  owner-or-admin, same shape for SELECT/INSERT/UPDATE/DELETE:
  - `foldername[1] = auth.uid()::text`, OR
  - `foldername[1] = 'wardrobe'` AND (`foldername[2] = auth.uid()::text` OR
    `foldername[2] IN (SELECT id::text FROM wardrobes WHERE owner_id = auth.uid())`), OR
  - `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`
  Header carries the same "deploy code first, then apply" coordination note
  as migration 03.
- **`scripts/cleanup_orphaned_wardrobe_files.ts`** — dry-run by default:
  lists `studio-wardrobe` objects whose top folder maps to no live
  profile/wardrobe and which no `wardrobe_items.image_url` or
  `lookbooks.thumbnail_url` references; `--delete` executes. User-run only.

## 5. Error handling

- Uploads keep the toast-per-failure pattern.
- `signWardrobeItems` already degrades gracefully (unsignable → original URL →
  SafeImage fallback); unchanged.
- Lookbook thumbnail upload stops discarding its error: failure keeps the old
  thumbnail and surfaces a warning toast.
- `ownerId: null` in client view cannot occur (my-studio always has an owner);
  components treat it as stylist context.

## 6. Testing

TDD throughout. Dev suite is 212 tests; stays green and grows.

- **Unit:** `wardrobe-paths` decision table; `createIntakeUploadUrl` /
  `createIntakeItem` (token validation, path shape, allowlist, no bytes
  through the action); VirtualWardrobe/DigitalLookbook insert payloads carry
  both ids (mock-supabase pattern from `studio.test.ts` / `wardrobes.test.ts`).
- **Policy verification (post-apply):** `scripts/` SQL-level script asserting
  owner can sign own-folder and owned-wardrobe-folder paths, another
  authenticated user cannot, admin can. Run after the user applies migration
  07 (mirrors how migration 03 was verified).
- **E2E:** `tests/e2e/intake-flow.spec.ts` only asserts page-level behavior
  (invalid token error, no-login access) and needs no changes; the new intake
  actions are covered at the unit level.

## 7. Rollout

All work on **Dev**; the user merges/deploys and applies SQL.

1. Code + migration files + cleanup script land on Dev (this plan).
2. User merges/deploys; wardrobe images still load (new policy is applied
   later; current authenticated-only policy is a superset for legit users,
   and all new write paths are readable under both old and new policies).
3. User applies migration 06, then 07.
4. User runs the policy verification script; then optionally the orphan
   cleanup (dry-run first).

Branch note: Dev currently lacks main's 2026-07-11 commits (vault-assets
direct upload, ServiceForm fix, Vimeo parsing). No file overlap with this
work; either merge direction is safe.
