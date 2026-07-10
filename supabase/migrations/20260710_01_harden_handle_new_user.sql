-- P0 #3 — Prevent admin self-escalation at signup.
--
-- The previous handle_new_user() copied `role` straight from
-- raw_user_meta_data->>'role'. That metadata is client-writable via the anon
-- key: `supabase.auth.signUp({ options: { data: { role: 'admin' } } })`.
-- This version ALWAYS inserts role = 'user'. Admins must be promoted
-- deliberately (a separate, gated admin action / manual DB update) — never
-- through self-service signup metadata.
--
-- Idempotent: CREATE OR REPLACE. Safe to apply even if the live body already
-- hardcodes 'user'. Preserves the existing username generation + dedupe logic.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_username text;
  pf_exists boolean;
BEGIN
  -- Skip if a profile already exists (avoid PK violation).
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) INTO pf_exists;
  IF pf_exists THEN
    RETURN new;
  END IF;

  new_username := new.raw_user_meta_data->>'username';

  IF new_username IS NULL OR length(new_username) < 3 THEN
    new_username := split_part(new.email, '@', 1);
    IF length(new_username) < 3 THEN
      new_username := new_username || '_' || floor(random() * 1000)::text;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) THEN
    new_username := new_username || '_' || floor(random() * 1000)::text;
  END IF;

  INSERT INTO public.profiles (id, full_name, username, avatar_url, email, role, language_preference)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New Stylist'),
    new_username,
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    'user', -- SECURITY: never trust client-supplied role metadata.
    COALESCE(new.raw_user_meta_data->>'language', 'en')
  );

  RETURN new;
END;
$$;

-- Ensure the trigger is bound (no-op if already present).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- OPTIONAL remediation: demote any account that self-escalated to admin via
-- signup metadata. Review the list before running the UPDATE.
--
--   SELECT id, email, role FROM public.profiles WHERE role = 'admin';
--
-- Then, keeping only the legitimate admin id(s):
--
--   UPDATE public.profiles SET role = 'user'
--   WHERE role = 'admin' AND id NOT IN ('<legit-admin-uuid>');
