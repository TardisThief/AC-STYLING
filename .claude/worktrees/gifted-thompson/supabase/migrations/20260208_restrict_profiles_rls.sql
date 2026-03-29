-- Migration: Restrict 'profiles' table RLS policy
-- Purpose: Remove the anonymous reading of sensitive PII data, as the application strictly enforces auth down to the server-action level.

-- 1. Drop the excessively permissive policy on profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- 2. Create the precise isolated policy for users
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND id = auth.uid()
  );

-- 3. Create explicit explicit visibility policy for admins
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
    )
  );
