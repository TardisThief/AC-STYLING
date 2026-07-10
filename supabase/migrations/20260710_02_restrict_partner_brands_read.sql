-- P0 #6 — Stop leaking partner_brands internal data to the public.
--
-- The RLS policy "Public view brands" (SELECT -> public) lets anyone read every
-- column of partner_brands, including internal_notes, commission_rate,
-- contact_email, and contact_name.
--
-- Fix (non-destructive, reversible): keep the public ROW policy, but remove
-- column-level SELECT on the sensitive columns from anon/authenticated and
-- re-grant SELECT only on the display columns. Admin tooling reads the sensitive
-- columns through the service-role client (getAdminBrands), which bypasses these
-- grants. No columns are dropped and no data is moved.
--
-- The `brand:partner_brands(name)` joins in the boutique/dashboard keep working
-- because `name` (and `id`) remain granted.
--
-- Coordinated code (ship BEFORE applying, already on this branch):
--   * getActiveBrands() selects only the display columns (no more select('*')).
--   * getAdminBrands() (admin + service role) reads the full row for the editor.

-- Replace table-level SELECT with column-level SELECT on display columns only.
-- (Postgres has no "table SELECT minus columns" — you drop the table grant and
--  grant the safe columns explicitly.)
REVOKE SELECT ON public.partner_brands FROM anon, authenticated;

GRANT SELECT (
  id,
  name,
  logo_url,
  website_url,
  partnership_status,
  active,
  order_index
) ON public.partner_brands TO anon, authenticated;

-- internal_notes, commission_rate, contact_email, contact_name are intentionally
-- NOT granted → anon/authenticated SELECT of those columns now errors with
-- "permission denied for column", closing the leak. Admins read them via the
-- service role (getAdminBrands).

-- Rollback (if ever needed):
--   GRANT SELECT ON public.partner_brands TO anon, authenticated;
