-- Migration: Fix infinite recursion on profiles RLS
-- Purpose: The previous admin policy triggered an infinite loop because evaluating the rule on profiles required querying profiles, which re-evaluated the rule ad infinitum.

-- 1. Create a secure view/function to bypass RLS for role checks
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 3. Recreate the policy using the secure function
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND public.get_user_role(auth.uid()) = 'admin'
  );
