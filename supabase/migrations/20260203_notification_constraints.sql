-- ============================================================================
-- Sprint 2.1: Unique Constraints for Notifications
-- ============================================================================
-- Purpose: Prevent duplicate admin notifcations for the same Stripe event
-- Date: 2026-02-02
-- 
-- STRATEGY:
-- 1. Add UNIQUE constraint to admin_notifications(reference_id)
-- 2. This ensures database-level prevention of race conditions
-- ============================================================================

-- First, remove duplicates if any exist (keep the first one)
DELETE FROM public.admin_notifications
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
        ROW_NUMBER() OVER (partition BY reference_id ORDER BY created_at ASC) as r_num
        FROM public.admin_notifications
        WHERE reference_id IS NOT NULL
    ) t
    WHERE t.r_num > 1
);

-- Add the constraint
ALTER TABLE public.admin_notifications
ADD CONSTRAINT unique_reference_id UNIQUE (reference_id);
