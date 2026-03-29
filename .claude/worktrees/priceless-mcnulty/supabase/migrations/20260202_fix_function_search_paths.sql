-- ============================================================================
-- Sprint 2: Fix Mutable Function Search Paths
-- ============================================================================
-- Purpose: Fix "Function search_path is mutable" warnings from Supabase linter
-- Date: 2026-02-02
-- strategy: Use ALTER FUNCTION to set search_path = '' (immutable)
-- This avoids needing to redefine the entire function body.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. check_access (Used in utils/access-control.ts)
-- -----------------------------------------------------------------------------
-- Signature inferred from code: check_access(check_user_id uuid, check_object_id uuid)
ALTER FUNCTION public.check_access(uuid, uuid) SET search_path = '';

-- -----------------------------------------------------------------------------
-- 2. clone_lookbook (Used in DigitalLookbook.tsx)
-- -----------------------------------------------------------------------------
-- Signature inferred: clone_lookbook(source_lookbook_id uuid, target_client_id uuid)
ALTER FUNCTION public.clone_lookbook(uuid, uuid) SET search_path = '';

-- -----------------------------------------------------------------------------
-- 3. Triggers (No arguments)
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.handle_new_purchase() SET search_path = '';
ALTER FUNCTION public.handle_updated_at() SET search_path = '';

-- -----------------------------------------------------------------------------
-- 4. Unverified Functions (Please uncomment if they exist and signatures match)
-- -----------------------------------------------------------------------------

-- If clone_wardrobe_item takes (wardrobe_item_id, target_wardrobe_id)
-- ALTER FUNCTION public.clone_wardrobe_item(uuid, uuid) SET search_path = '';

-- If check_wardrobe_eligibility takes (user_id)
-- ALTER FUNCTION public.check_wardrobe_eligibility(uuid) SET search_path = '';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
