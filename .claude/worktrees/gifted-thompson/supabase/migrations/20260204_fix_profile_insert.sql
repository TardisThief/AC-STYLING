-- ============================================================================
-- Sprint 2.2: Fix Profile Creation & Purchase Logic
-- ============================================================================
-- Purpose: Fix "Missing Profile" issue by allowing INSERT on profiles table
--          (Use trigger context: user inserts their own profile via trigger)
-- Date: 2026-02-04
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profiles - Add INSERT policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND id = auth.uid()
);

-- Note: The trigger handle_new_user runs with the permissions of the user 
-- (unless SECURITY DEFINER is set), so they need INSERT permission.

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
