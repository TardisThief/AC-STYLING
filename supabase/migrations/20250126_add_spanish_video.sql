-- Migration: Add Spanish video support to chapters
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS video_id_es TEXT;

-- Notify
DO $$
BEGIN
    RAISE NOTICE 'Migration 20250126_add_spanish_video completed.';
END $$;
