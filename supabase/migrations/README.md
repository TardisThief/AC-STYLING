# Supabase migrations

These SQL files re-establish version control for schema/RLS/trigger/storage
changes (the historical migrations were reset in the 2026-07 cleanup).

## Baseline snapshot

`00000000000000_baseline.sql` is a machine-generated `pg_dump --schema-only`
snapshot of the live `public` schema (2026-07-10), captured **after** the dated
change-migrations below were applied. It is the version-controlled source of
truth for the current DB structure (tables, RLS, triggers, functions, grants) —
for drift detection, schema review, and disaster recovery. It intentionally
overlaps with the dated migrations, which remain the reviewable changelog of how
the security posture got here. Regenerate it after future schema changes with
`pg_dump --schema-only --schema=public "$DATABASE_URL"` (write UTF-8).

## Migration execution policy

As authorized by the project owner on 2026-09-19, **agents may review, execute,
and verify migrations themselves**, including on the shared production database,
as part of assigned work. A separate owner application step or repeat permission
request is not required. This supersedes the owner-only execution instructions
in historical plans and migration comments.

The Supabase project is a **single shared instance**: running SQL here affects
**production immediately**. Migrations are deliberately executed, not blindly
auto-applied in filename order. The executing agent must:

1. Inspect live schema state and dependencies; preserve other agents' work.
2. Review the SQL and validate affected permissions/behavior in isolation.
3. Deploy and verify prerequisite application changes before incompatible SQL.
4. Capture the affected schema/configuration for recovery; use transactions and
   lock/statement timeouts where supported. Avoid customer-data mutations unless
   needed for the assigned migration.
5. Apply only the pending migration, then verify the live result and affected
   workflows. Record the file checksum, application time, deployment revision,
   verification results, and any remaining limitations in the release record
   and roadmap. Do not mark unperformed checks complete.

This authority does not authorize unrelated destructive data operations. If a
required deployment or connection is unavailable, resolve that dependency or
report the actual blocker rather than bypassing the release sequence.

## P0 security migrations (2026-07-10)

Apply in order. Read the header comment in each file first.

| File | Fixes | Notes |
|---|---|---|
| `20260710_01_harden_handle_new_user.sql` | #3 admin self-escalation | Safe to apply as-is. After applying, verify a signup with `data:{role:'admin'}` yields `role='user'`. Includes an optional demote-existing-admins block — review before running. |
| `20260710_02_restrict_partner_brands_read.sql` | #6 partner_brands PII leak | Non-destructive column-level `REVOKE`/`GRANT` (no data moved). Ship the coordinated code first: `getActiveBrands()` selects display columns only, admin editor uses `getAdminBrands()` (service role). On the shared DB, deploy that code to **production** before applying, or prod's old `select('*')` on `partner_brands` breaks. Reversible via the rollback line in the file. |
| `20260710_03_lock_studio_wardrobe_bucket.sql` | #7 world-readable wardrobe photos | **Coordinate with code.** Makes the bucket private + authenticated-only (no anon read/write) → `getPublicUrl` links break, so the app now renders signed URLs (`lib/wardrobe-images.ts`, wired into the wardrobe/lookbook components on this branch). Deploy that code to production and verify wardrobe images load, THEN apply. Uses authenticated-only (not strict per-owner) because the upload folder convention is inconsistent — see the note in the file and the AUDIT P2 item. |
| `20260710_04_email_rate_limits.sql` | P1 email rate limiting | Additive (new `rate_limits` table + `check_rate_limit` function). Safe to apply anytime; the app fails open if it's absent, so code can ship first. Reversible: `DROP FUNCTION public.check_rate_limit; DROP TABLE public.rate_limits;` |
| `20260710_05_stripe_processed_events.sql` | P1 webhook idempotency | Additive (new `stripe_processed_events` table). Safe to apply anytime; the webhook fails open if it's absent, so code can ship first. Reversible: `DROP TABLE public.stripe_processed_events;` |

## September authorization release

The September assessment found additional authorization gaps after the July
fixes. See [release dependencies and verification](../../docs/RELEASE-2026-09-19-AUTHORIZATION.md).

| File | Status / dependencies |
|---|---|
| `20260711_06_lookbooks_canvas_columns.sql` | Recorded applied in roadmap; baseline overlaps these historical changes. |
| `20260711_07_owner_scope_studio_wardrobe.sql` | Owner/admin policy present in live September inspection. |
| `20260715_08_private_internal_note.sql` | Private-column restriction present in live September inspection. |
| `20260911_10_catalog_publication.sql` | Publication columns present live. **Dependency of 09**, despite filename order. |
| `20260911_09_chapter_video_entitlement.sql` | Video-column restriction and entitlement RPC present live; requires 10. |
| `20260911_11_founding_cohort_grants.sql` | Cohort schema present live; this does not establish content/payment launch readiness. |
| `20260919_12_authorization_boundaries.sql` | **Applied and verified 2026-09-20 03:53 UTC (September 19 EDT)** by the agent, after production release `87dea9e`. All 13 structural and 33 live smoke checks pass; temporary fixtures removed. See the release verification record. |
| `20260920_13_purchase_claims.sql` | **Applied and verified 2026-09-20 17:0x UTC** by the agent. Fixes F06. Purely additive (new `purchase_claims` table), so it was safe to apply ahead of the code that uses it; the code fails closed if the table is absent. sha256 `5ea5ae2ff3d04bbd8b058e1e0b3a1b66398009f8d67ade34ef9b7f6b2cab1cda`. Dry-run first in a rolled-back transaction, then committed. Verified live: table present, RLS enabled **and** forced, 0 policies, 0 grants to `anon`/`authenticated`/`PUBLIC`, 4 indexes, and the single-use property (first consume returns 1 row, a second returns 0) — probe row removed in both runs. No backfill: 0 accounts carried `pending_password` and 0 were in the exploitable "has a password but still flagged claimable" state. Reversible: `DROP TABLE public.purchase_claims;` |
| `20260920_14_fulfillments.sql` | **Applied and verified 2026-09-20** by the agent. Completes F05. Additive: new `fulfillments` table (one row per Stripe line item, unique on `stripe_line_item_id`, status `processing`/`completed`/`failed`/`unfulfillable`), plus a nullable `stripe_line_item_id` column and a **partial** unique index on `purchases` — partial so the 5 pre-existing rows (all null) are unaffected. Dry-run first in a rolled-back transaction, then committed. Verified live: RLS enabled **and** forced, 0 policies, 0 grants to `anon`/`authenticated`/`PUBLIC`, and five behaviour probes — a duplicate line item is rejected, a completed row cannot be re-claimed, an invalid status is refused by the check constraint, a duplicate purchase for one line item is rejected, and legacy null-line-item rows still coexist. All probe rows removed in both runs. Reversible: `DROP TABLE public.fulfillments; DROP INDEX IF EXISTS public.purchases_line_item_unique; ALTER TABLE public.purchases DROP COLUMN IF EXISTS stripe_line_item_id;` |
| `20260920_15_account_deletion.sql` | **Applied and verified 2026-09-20** by the agent. Fixes F11 **and a gap the finding missed**: `public.profiles` had no FK to `auth.users` at all, so a "successful" account deletion left the profile and everything cascading from it. Proven on the live DB first: deleting a user with course progress failed on `user_progress_user_id_fkey`. Sets `user_progress.user_id` to CASCADE, `tailor_cards.last_updated_by` to SET NULL (audit attribution — cascading would delete a *client's* card because a *stylist* left), removes 10 orphaned `@example.invalid` fixture profiles left behind by migration 12's own cleanup, and adds `profiles.id -> auth.users(id) ON DELETE CASCADE`. Dry-run first; the probe deleted a user with 9 progress rows and 10 essence responses and confirmed profile, progress and essence all went with them, then rolled back. After apply: 16 profiles, **0 orphaned, 0 blocking FKs to `auth.users`**. **Caveat recorded in the file:** the applied DELETE guard enumerated seven child tables and missed `tailor_cards`, so two fixture-owned tailor cards cascaded; checked afterwards and both surviving cards belong to real accounts, so nothing of value was lost. The committed SQL now includes that guard. |

Do not blindly replay the baseline and dated files against a fresh or live DB.
They overlap, and filename order is not a complete dependency plan. Migration 12
was tested against an isolated fixture of the affected live authorization state.
After application, run `node scripts/verify_authorization.mjs` and the
release smoke checks before marking it verified in production.

## Verifying #3 after apply

```sql
-- Confirm the trigger function no longer trusts client role metadata:
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
-- Confirm no unexpected admins:
SELECT id, email, role FROM public.profiles WHERE role = 'admin';
```
