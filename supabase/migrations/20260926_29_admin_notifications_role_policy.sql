-- Migration 29 — the notification inbox belongs to the admin role, not a person
--
-- The problem (demonstrated in tests/integration/admin-notifications.test.ts,
-- against the live schema)
-- -----------------------------------------------------------------------
-- "Admin full access to notifications" granted ALL to one hardcoded user id,
-- 4613bce4-…. Checked 2026-09-26: that id is neither of the two admin
-- accounts; the account it named no longer exists. The policy granted
-- everything to a missing identity and nothing to the real admins. The app
-- reads the inbox with the service role after requireAdmin(), so nothing
-- visibly broke, but the table carries buyers' names, emails and phones and
-- its access rule should name a role.
--
-- What this does
-- --------------
-- Replaces that policy with the admin check every other admin table uses
-- (profiles.role = 'admin' for auth.uid()). Members and anon stay at nothing.
--
-- Safety
-- ------
-- One policy replaced; no data touched. The DO block refuses unless the live
-- policy still names the hardcoded id.
--
-- Rollback: re-run the policy definition from the baseline before this file.

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
    qual text;
BEGIN
    SELECT p.qual INTO qual FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'admin_notifications'
      AND p.policyname = 'Admin full access to notifications';
    IF qual IS NULL THEN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_notifications'
                   AND policyname = 'admin_notifications: admin access') THEN
            RAISE EXCEPTION 'admin_notifications already has the role policy; migration 29 has been applied';
        END IF;
        RAISE EXCEPTION 'admin_notifications policy not found; inspect before applying';
    END IF;
    IF qual NOT LIKE '%4613bce4-5a40-4779-9e87-0def946be940%' THEN
        RAISE EXCEPTION 'live admin_notifications policy differs from the baseline (%); inspect before applying', qual;
    END IF;
END $$;

DROP POLICY "Admin full access to notifications" ON public.admin_notifications;

CREATE POLICY "admin_notifications: admin access" ON public.admin_notifications
    USING (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
    WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

COMMIT;
