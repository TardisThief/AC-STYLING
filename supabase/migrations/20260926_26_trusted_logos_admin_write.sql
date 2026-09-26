-- Migration 26 — only the admin writes the homepage trust logos
--
-- The problem (demonstrated in tests/integration/trusted-logos.test.ts,
-- against the live schema; found by the 2026-09-25 external assessment,
-- SEC-002)
-- -----------------------------------------------------------------------
-- The policy "trusted_by_logos: admin write" checks only
-- auth.role() = 'authenticated'. The table grants INSERT/UPDATE/DELETE to the
-- authenticated role, so any account — one made a minute ago on /signup —
-- can add, replace or delete the brand logos on the public homepage straight
-- through PostgREST. Migration 12 fixed this exact shape on the boutique
-- tables and missed this one; it is the only write policy left in the
-- baseline that equates "signed in" with "admin".
--
-- What this does
-- --------------
-- Replaces that one policy with the admin check every other catalogue table
-- uses (profiles.role = 'admin' for auth.uid()). The admin console writes
-- through the admin's own session client (app/actions/admin/manage-boutique.ts),
-- so it keeps working; the public read policy is untouched.
--
-- Safety
-- ------
-- One policy replaced; no data touched. The DO block refuses unless the live
-- policy is the baseline one.
--
-- Rollback:
--   DROP POLICY "trusted_by_logos: admin write" ON public.trusted_by_logos;
--   CREATE POLICY "trusted_by_logos: admin write" ON public.trusted_by_logos
--     USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
    qual text;
BEGIN
    SELECT p.qual INTO qual FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'trusted_by_logos'
      AND p.policyname = 'trusted_by_logos: admin write';
    IF qual IS NULL THEN
        RAISE EXCEPTION 'policy "trusted_by_logos: admin write" not found; inspect before applying';
    END IF;
    IF qual LIKE '%profiles%' THEN
        RAISE EXCEPTION 'trusted_by_logos admin write already checks the admin role; migration 26 has been applied';
    END IF;
    IF qual <> '(auth.role() = ''authenticated''::text)' THEN
        RAISE EXCEPTION 'live trusted_by_logos admin write differs from the baseline (%); inspect before applying', qual;
    END IF;
END $$;

DROP POLICY "trusted_by_logos: admin write" ON public.trusted_by_logos;

CREATE POLICY "trusted_by_logos: admin write" ON public.trusted_by_logos
    USING (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
    WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

COMMIT;
