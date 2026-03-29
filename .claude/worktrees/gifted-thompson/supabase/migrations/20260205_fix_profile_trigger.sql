-- ============================================================================
-- Sprint 2.3: Fix Profile Creation Trigger (Robust)
-- ============================================================================
-- Purpose: Ensure the profile creation trigger runs with SECURITY DEFINER
--          to bypass RLS policies that might block insertion.
--          Also verify trigger exists.
-- Date: 2026-02-05
-- ============================================================================

-- 1. Create/Replace the function with SECURITY DEFINER
--    This ensures it runs as the owner (superuser) and ignores RLS on 'profiles'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url', 
    new.email
  );
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN new;
  WHEN OTHERS THEN
    -- Log error but allow auth creation to succeed? 
    -- Actually, if profile fails, app breaks. Better to raise warning.
    RAISE WARNING 'Profile creation failed: %', SQLERRM;
    RETURN new;
END;
$$;

-- 2. Drop legacy trigger if exists (standard name) to ensure we use the new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. JUST IN CASE: Allow service_role to insert (if another trigger name is used)
DROP POLICY IF EXISTS "Service role can insert profile" ON public.profiles;

CREATE POLICY "Service role can insert profile"
ON public.profiles FOR INSERT
TO service_role
WITH CHECK (true);

-- 5. Ensure users can insert (fallback for client-side inserts if any, though unlikely)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND id = auth.uid()
);
