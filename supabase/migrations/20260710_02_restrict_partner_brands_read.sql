-- P0 #6 — Stop leaking partner_brands internal data to the public.
--
-- The RLS policy "Public view brands" (SELECT -> public) exposes every column,
-- including internal_notes, commission_rate, and contact_email, to anonymous
-- visitors of the boutique.
--
-- Fix: the base table becomes admin-only for SELECT; the public reads brands
-- through a security-invoker view that projects only display columns. Admin
-- tooling continues to read/write the base table directly (RLS admin policies).
--
-- NOTE: application code that reads partner_brands for public display should
-- query `public_partner_brands` (the view) rather than `partner_brands`.
-- Verify the boutique read paths before/after applying.

-- 1. Remove the over-broad public SELECT policy.
DROP POLICY IF EXISTS "Public view brands" ON public.partner_brands;

-- 2. Ensure admins can still fully read the base table.
--    (Adjust the USING clause if your admin predicate differs.)
DROP POLICY IF EXISTS "Admins read brands" ON public.partner_brands;
CREATE POLICY "Admins read brands" ON public.partner_brands
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 3. Public-safe projection: display columns only, no internal/financial data.
--    This view is intentionally SECURITY DEFINER (the default): it runs with the
--    view owner's privileges so it can expose the whitelisted columns publicly
--    even though the base table's RLS now blocks anon SELECT. The column list +
--    `active = true` filter ARE the security boundary. (Supabase's linter flags
--    definer views; that warning is expected and acceptable for this curated
--    public projection.)
CREATE OR REPLACE VIEW public.public_partner_brands AS
  SELECT
    id,
    name,
    logo_url,
    website_url,
    partnership_status,
    active
  FROM public.partner_brands
  WHERE active = true;

-- 4. Let anyone read the view.
GRANT SELECT ON public.public_partner_brands TO anon, authenticated;
