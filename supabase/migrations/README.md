# Supabase migrations

These SQL files re-establish version control for schema/RLS/trigger/storage
changes (the historical migrations were reset in the 2026-07 cleanup).

## ⚠️ These are NOT auto-applied

The Supabase project is a **single shared instance** — running SQL here hits
**production immediately**. The agent does **not** apply these; you do,
deliberately, in the Supabase SQL Editor after reviewing each file.

## P0 security migrations (2026-07-10)

Apply in order. Read the header comment in each file first.

| File | Fixes | Notes |
|---|---|---|
| `20260710_01_harden_handle_new_user.sql` | #3 admin self-escalation | Safe to apply as-is. After applying, verify a signup with `data:{role:'admin'}` yields `role='user'`. Includes an optional demote-existing-admins block — review before running. |
| `20260710_02_restrict_partner_brands_read.sql` | #6 partner_brands PII leak | Non-destructive column-level `REVOKE`/`GRANT` (no data moved). Ship the coordinated code first: `getActiveBrands()` selects display columns only, admin editor uses `getAdminBrands()` (service role). On the shared DB, deploy that code to **production** before applying, or prod's old `select('*')` on `partner_brands` breaks. Reversible via the rollback line in the file. |
| `20260710_03_lock_studio_wardrobe_bucket.sql` | #7 world-readable wardrobe photos | **Coordinate with code.** Makes the bucket private → `getPublicUrl` links break until the app switches to signed URLs (P1). Apply together with that code change. |

## Verifying #3 after apply

```sql
-- Confirm the trigger function no longer trusts client role metadata:
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
-- Confirm no unexpected admins:
SELECT id, email, role FROM public.profiles WHERE role = 'admin';
```
