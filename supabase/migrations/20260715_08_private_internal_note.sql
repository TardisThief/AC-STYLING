-- Make wardrobe_items.internal_note genuinely private to the stylist.
--
-- The Studio's item panel labelled `notes` as "Ale's Private Note" for the
-- admin, with the placeholder "Notes visible only to you..." — while the client
-- view rendered that same column to the client as "Stylist Note". Anything
-- written there in confidence was shown to the client it was written about.
--
-- The schema already had the right column for this (`internal_note`), but no
-- code ever rendered it: it was written by the boutique import and never read.
-- The UI now uses `notes` as the shared note ("Note to Client", labelled as
-- such) and `internal_note` as the private one.
--
-- Labels alone are not enough. GRANT ALL ON wardrobe_items TO authenticated
-- plus the "Users can view own wardrobe items" row policy means a client's
-- browser can read AND write every column of their own rows — the client view
-- literally did select('*'), so internal_note was already being shipped to the
-- client's browser. A note is only private if the client cannot reach the
-- column at all.
--
-- Fix (non-destructive, reversible): keep the row policies, but remove
-- column-level SELECT/UPDATE on internal_note from anon/authenticated and
-- re-grant the remaining columns explicitly. Mirrors migration 02
-- (partner_brands.internal_notes). No columns are dropped, no data is moved.
--
-- Column privileges are not role-aware beyond the Postgres role, and Ale is
-- `authenticated` like her clients — so this hides the column from her browser
-- client too. That is why admin reads/writes moved to the service role:
--   * getAdminWardrobeItems()    — reads the full row for the Studio panel
--   * updateAdminWardrobeItem()  — writes internal_note (and other admin edits)
--   * bulkSetItemStatus()        — bulk curation status
--
-- ORDER MATTERS — ship the coordinated code BEFORE applying this migration:
-- the client view previously ran select('*') on wardrobe_items, which would
-- start failing with "permission denied for column internal_note" the moment
-- this runs. The code on this branch selects CLIENT_ITEM_COLUMNS explicitly
-- (app/lib/wardrobe-columns.ts) and is safe either way.

-- Postgres has no "table SELECT minus one column": drop the table-level grant
-- and re-grant the safe columns explicitly.
REVOKE SELECT, UPDATE, INSERT ON public.wardrobe_items FROM anon, authenticated;

GRANT SELECT (
  id,
  user_id,
  wardrobe_id,
  image_url,
  category,
  client_note,
  notes,
  brand,
  status,
  tags,
  product_link_id,
  is_general_library,
  created_at,
  updated_at
) ON public.wardrobe_items TO anon, authenticated;

-- Clients edit their own note and may re-categorise an item; curation status is
-- the stylist's call and is applied through the admin actions.
GRANT UPDATE (
  category,
  client_note,
  tags,
  brand,
  updated_at
) ON public.wardrobe_items TO authenticated;

-- Guest intake inserts rows for a wardrobe the user has just claimed
-- ("Users can insert own wardrobe items during intake"); keep that working
-- without granting internal_note.
GRANT INSERT (
  user_id,
  wardrobe_id,
  image_url,
  category,
  client_note,
  notes,
  brand,
  status,
  tags,
  product_link_id,
  is_general_library
) ON public.wardrobe_items TO authenticated;

-- DELETE is row-scoped by RLS and needs no column list.
GRANT DELETE ON public.wardrobe_items TO authenticated;

-- internal_note is intentionally NOT granted to anon/authenticated →
-- selecting or writing it from a browser client now errors with
-- "permission denied for column". The stylist reaches it via the service role.

-- Rollback (if ever needed):
--   GRANT SELECT, UPDATE, INSERT ON public.wardrobe_items TO anon, authenticated;
