-- Migration 24 — a member can add items only to her own wardrobe
--
-- The problem (demonstrated in tests/integration/wardrobe-storage.test.ts,
-- against the live schema)
-- -----------------------------------------------------------------------
-- "Users can insert own wardrobe items during intake" checks
-- `auth.uid() = user_id` and nothing else. `wardrobe_id` is unconstrained, so
-- any signed-in member can insert, straight through PostgREST, an item with
-- her own user_id into ANOTHER client's wardrobe — with any image_url and any
-- client_note. The victim's own SELECT policy ("Users can view own wardrobe
-- items") shows her every item whose wardrobe_id is one of hers, so the
-- planted item appears in her wardrobe, and in the stylist's view of it.
-- It needs the victim's wardrobe UUID, which is not guessable, so this is
-- defence in depth rather than an open door — but the policy's name says
-- "own", and it did not mean it.
--
-- What this does
-- --------------
-- Replaces the policy with one that also requires the wardrobe, when given,
-- to be owned by the caller. Every legitimate member insert already satisfies
-- it: components/vault/GatedWardrobe.tsx inserts into the wardrobe returned by
-- getMyWardrobe(). Stylist inserts (VirtualWardrobe) go through the separate
-- admin policy, and token intake runs as the service role; neither is
-- affected. A NULL wardrobe_id (legacy rows) stays allowed, as before, and is
-- visible only to its own user_id.
--
-- Safety
-- ------
-- One policy replaced; no data touched. The DO block refuses unless the live
-- policy is the one this replaces.
--
-- Rollback:
--   DROP POLICY "Users can insert own wardrobe items during intake" ON public.wardrobe_items;
--   CREATE POLICY "Users can insert own wardrobe items during intake" ON public.wardrobe_items
--     FOR INSERT WITH CHECK (auth.uid() = user_id);

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
    live text;
BEGIN
    SELECT pg_get_expr(polwithcheck, polrelid) INTO live
    FROM pg_policy
    WHERE polrelid = 'public.wardrobe_items'::regclass
      AND polname = 'Users can insert own wardrobe items during intake';

    IF live IS NULL THEN
        RAISE EXCEPTION 'intake insert policy not found; inspect before applying';
    END IF;
    IF live LIKE '%wardrobes%' THEN
        RAISE EXCEPTION 'intake insert policy already checks the wardrobe; migration 24 has been applied';
    END IF;
    IF live <> '(auth.uid() = user_id)' THEN
        RAISE EXCEPTION 'live intake insert policy differs from the baseline (%); inspect before applying', live;
    END IF;
END $$;

DROP POLICY "Users can insert own wardrobe items during intake" ON public.wardrobe_items;

CREATE POLICY "Users can insert own wardrobe items during intake" ON public.wardrobe_items
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            wardrobe_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.wardrobes w
                WHERE w.id = wardrobe_id AND w.owner_id = auth.uid()
            )
        )
    );

COMMIT;
