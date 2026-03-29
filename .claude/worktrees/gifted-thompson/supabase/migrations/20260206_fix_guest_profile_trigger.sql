-- ============================================================================
-- Fix Guest Profile Trigger
-- ============================================================================
-- Purpose: Update the handle_new_user trigger to correctly map auth.users.is_anonymous 
--          to profiles.is_guest.
-- Date: 2026-02-06
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    avatar_url, 
    email, 
    is_guest
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url', 
    new.email,
    COALESCE(new.is_anonymous, false)
  );
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN new;
  WHEN OTHERS THEN
    RAISE WARNING 'Profile creation failed: %', SQLERRM;
    RETURN new;
END;
$$;
