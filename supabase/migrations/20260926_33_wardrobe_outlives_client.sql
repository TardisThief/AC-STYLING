-- Migration 33 — a wardrobe's garments and lookbooks outlive the client who leaves
--
-- The problem (demonstrated in tests/integration/wardrobe-outlives-client.test.ts,
-- against the live schema)
-- -----------------------------------------------------------------------
-- Owner decisions 2026-09-26: a wardrobe outlives the client who deletes her
-- account, and so do its garments and lookbooks. wardrobes.owner_id was
-- already ON DELETE SET NULL, but wardrobe_items.user_id and lookbooks.user_id
-- were ON DELETE CASCADE to her profile, so the wardrobe survived empty.
--
-- What this does
-- --------------
-- Both foreign keys become ON DELETE SET NULL (both columns are already
-- nullable). A deleted client's garments and lookbooks stay in their
-- wardrobe, detached from her. Read access follows the wardrobe: the existing
-- policies let its owner (after reassignment) and admins see them.
--
-- Garments and lookbooks that belong to NO wardrobe are hers alone:
-- deleteAccount deletes them explicitly before deleting the account, and
-- moves the wardrobe's photos into wardrobe/<id>/ (see app/actions/vault/
-- account.ts and app/lib/wardrobe-relocation.ts).
--
-- Safety
-- ------
-- Constraint changes only; no data touched (0 garments and 0 lookbooks live
-- on 2026-09-26). The DO block refuses if either rule is already SET NULL.
--
-- Rollback: recreate both FKs with ON DELETE CASCADE.

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname IN ('wardrobe_items_user_id_fkey', 'lookbooks_user_id_fkey')
                 AND confdeltype = 'n') THEN
        RAISE EXCEPTION 'wardrobe_items/lookbooks user_id already ON DELETE SET NULL; migration 33 has been applied';
    END IF;
END $$;

ALTER TABLE public.wardrobe_items DROP CONSTRAINT wardrobe_items_user_id_fkey;
ALTER TABLE public.wardrobe_items ADD CONSTRAINT wardrobe_items_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lookbooks DROP CONSTRAINT lookbooks_user_id_fkey;
ALTER TABLE public.lookbooks ADD CONSTRAINT lookbooks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMIT;
