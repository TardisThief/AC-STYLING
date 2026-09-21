-- Migration 18 — rename "The AC Method" to "Style & Essence", in place
--
-- The problem
-- -----------
-- The course is being repositioned: no longer a branded "method" but the
-- course about showing your essence through what you wear, third in the path
-- Colorimetry → Body Shape → Style & Essence → Closet Curation.
--
-- `scripts/import_catalog.mjs` matches masterclasses by `title` and never
-- deletes. Renaming the course in the catalogue file alone would therefore
-- insert a *second* row and leave "The AC Method" in place — and with
-- VAULT_REVEAL_UPCOMING on, that orphan renders as an "In production" card on
-- /vault-access. So the title is changed here, on the existing row, and the
-- importer then updates that row with the new copy, order and modules.
--
-- Safety
-- ------
-- One row, unpublished, no Stripe product. A search of every text/json column
-- in `public` found the string "AC Method" in `masterclasses.title` only, so
-- nothing else keys on it. The row's id (and so any grant or progress that
-- points at it) is unchanged. The DO block refuses to commit unless exactly
-- one row was renamed.
--
-- Rollback:
--   UPDATE public.masterclasses SET title = 'The AC Method'
--   WHERE title = 'Style & Essence';
-- (then re-import the previous catalogue file if the copy should revert too).

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
    renamed integer;
BEGIN
    UPDATE public.masterclasses
    SET title = 'Style & Essence'
    WHERE title = 'The AC Method';

    GET DIAGNOSTICS renamed = ROW_COUNT;
    IF renamed <> 1 THEN
        RAISE EXCEPTION 'expected to rename exactly 1 masterclass, renamed %', renamed;
    END IF;

    IF (SELECT count(*) FROM public.masterclasses WHERE title = 'Style & Essence') <> 1 THEN
        RAISE EXCEPTION 'title "Style & Essence" is not unique after the rename';
    END IF;
END $$;

COMMIT;
