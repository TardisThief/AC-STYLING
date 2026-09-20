-- Migration 15 — make account deletion actually delete the account
--
-- Addresses F11 in docs/ASSESSMENT-2026-09-19.md, and one thing it did not
-- catch.
--
-- What was measured on the live database before writing this
-- ---------------------------------------------------------
-- 1. `DELETE FROM auth.users` for a user with course progress **fails**:
--
--      update or delete on table "users" violates foreign key constraint
--      "user_progress_user_id_fkey" on table "user_progress"
--
--    So "Delete my account" does not work today for anyone who has watched
--    anything. 15 `user_progress` rows and 4 `tailor_cards.last_updated_by`
--    references are live, and `deleteAccount` carries the comment "Assuming
--    cascade is set up", which is exactly the assumption that is false.
--
-- 2. Not in the finding, and worse: **`public.profiles` has no foreign key to
--    `auth.users` at all** — only a primary key. So even once deletion is
--    unblocked, the profile row survives, and with it everything that cascades
--    from `profiles`: `wardrobe_items`, `lookbooks`, `user_questions`,
--    `user_access_grants`, `tailor_cards`. Deleting the auth user would look
--    like it worked and leave the person's data in place.
--
--    This is not hypothetical. 10 of 26 profiles were already orphaned — their
--    auth users are gone and their profiles are not. All 10 are
--    `@example.invalid` fixtures created 2026-09-20 with zero related rows:
--    migration 12's authorization test users. The README records those
--    fixtures as removed, and the auth half was; the profiles half could not
--    cascade because this constraint did not exist.
--
-- What this does
-- --------------
--   a. `user_progress.user_id` cascades. Course progress is the person's own
--      record and goes with them.
--   b. `tailor_cards.last_updated_by` sets null. It is an audit field naming
--      whoever last edited the card — usually the stylist — so cascading it
--      would delete a *client's* tailor card because a *stylist* closed their
--      account. The column is already nullable.
--   c. Removes the 10 orphaned fixture profiles, scoped so it cannot match
--      anything else (orphaned AND @example.invalid AND no related rows).
--
--      Recorded because it should not be repeated: the guard list below
--      enumerated seven child tables and MISSED `tailor_cards`, which also
--      cascades from `profiles`. Two tailor_cards rows therefore went with the
--      fixture profiles in the applied run. They were checked afterwards and
--      were fixture-owned — the two surviving rows both belong to real
--      (gmail.com) accounts — so nothing of value was lost, but the check
--      should have been exhaustive before the delete, not after it. The guard
--      now includes `tailor_cards`; the version applied to production on
--      2026-09-20 did not.
--   d. Adds `profiles.id -> auth.users(id) ON DELETE CASCADE`, so deletion
--      reaches everything downstream of the profile.
--
-- Deliberately unchanged: `wardrobes.owner_id` stays SET NULL. A wardrobe can
-- be stylist-managed and survive its client leaving, which is a product
-- decision about retention, not a bug to fix in a migration. It is raised in
-- docs/OWNER-ACTIONS.md instead.
--
-- Safety: (a), (b) and (d) alter constraints without touching row data. (c)
-- deletes 10 rows that are provably test residue. Applied before the matching
-- code change, which is safe because nothing currently depends on deletion
-- failing.
--
-- Rollback:
--   ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
--   ALTER TABLE public.user_progress DROP CONSTRAINT user_progress_user_id_fkey,
--     ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
--   ALTER TABLE public.tailor_cards DROP CONSTRAINT tailor_cards_last_updated_by_fkey,
--     ADD CONSTRAINT tailor_cards_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id);
--   (the 10 fixture rows are not restorable, and should not be)

BEGIN;

SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '10s';

-- (a) Course progress belongs to the person and goes with them.
ALTER TABLE public.user_progress
    DROP CONSTRAINT IF EXISTS user_progress_user_id_fkey;

ALTER TABLE public.user_progress
    ADD CONSTRAINT user_progress_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- (b) Audit attribution, not ownership: null it rather than destroying a
--     client's tailor card because a stylist left.
ALTER TABLE public.tailor_cards
    DROP CONSTRAINT IF EXISTS tailor_cards_last_updated_by_fkey;

ALTER TABLE public.tailor_cards
    ADD CONSTRAINT tailor_cards_last_updated_by_fkey
    FOREIGN KEY (last_updated_by) REFERENCES auth.users (id) ON DELETE SET NULL;

-- (c) Remove the orphaned fixture profiles so the constraint below can be
--     added validated. Every predicate must hold: no auth user, a reserved
--     test domain, and nothing of substance attached.
DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  AND p.email LIKE '%@example.invalid'
  AND NOT EXISTS (SELECT 1 FROM public.wardrobe_items w WHERE w.user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.purchases pu WHERE pu.user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.user_progress up WHERE up.user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.essence_responses er WHERE er.user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.lookbooks l WHERE l.user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.user_questions q WHERE q.user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.user_access_grants g WHERE g.user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.tailor_cards tc WHERE tc.user_id = p.id);

-- (d) The constraint whose absence made a successful-looking deletion a no-op.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT profiles_id_fkey ON public.profiles IS
    'Deleting an auth user removes the profile and everything cascading from it. Absent until migration 15, which is why deleted accounts left their data behind.';

COMMIT;
