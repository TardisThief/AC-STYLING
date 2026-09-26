-- Run against the TARGET database immediately BEFORE restoring the public
-- schema from a snapshot (docs/DISASTER-RECOVERY.md, Scenarios 2 and 3; and
-- scripts/backup/restore_drill.sh, which proves it).
--
-- Why: Supabase gives every new table, function and sequence in public ALL
-- for anon, authenticated and service_role, through default privileges.
-- pg_dump writes each object's ACL relative to Postgres's built-in default
-- (owner only): it emits the GRANTs production has and never REVOKEs a grant
-- it assumes was never there. Restored into a Supabase project as is, a
-- table like chapters keeps the platform's table-level SELECT for anon on
-- top of the dump's column grants, so video_id — and every other column the
-- migrations locked down — is readable again. Measured on 2026-09-26: a
-- restore without this step fails all three privilege checks in the drill.
--
-- Clearing the defaults makes restored objects start owner-only, so the
-- dump's own GRANT/REVOKEs reproduce production exactly. The dump also
-- carries ALTER DEFAULT PRIVILEGES entries, restored after the objects, which
-- put the platform defaults back for anything created later.
--
-- Scoped to objects created by postgres (the role pg_restore --no-owner runs
-- as) in schema public. Idempotent.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
