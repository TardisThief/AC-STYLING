-- Migration: Fix Essence Lab for Standalone Courses
-- 1. Add chapter_id to link responses directly to chapters
ALTER TABLE public.essence_responses ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint (which was based on user/masterclass/key)
-- Since it might be unnamed or have a default name, we drop by columns or using a DO block
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.essence_responses'::regclass
    AND contype = 'u'
    AND conkey @> (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'public.essence_responses'::regclass AND attname IN ('user_id', 'masterclass_id', 'question_key'));

    IF constraint_name IS NULL THEN
       -- try to find it without masterclass_id just in case
       SELECT conname INTO constraint_name
       FROM pg_constraint
       WHERE conrelid = 'public.essence_responses'::regclass
       AND contype = 'u';
    END IF;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.essence_responses DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- 3. Create a more flexible unique constraint
-- If Postgres 15+ is available, we use NULLS NOT DISTINCT
-- Otherwise, a unique index with COALESCE or conditional is used.
-- We'll use a Unique Index for maximum compatibility.
CREATE UNIQUE INDEX IF NOT EXISTS idx_essence_responses_uniqueness 
ON public.essence_responses (user_id, question_key, (COALESCE(masterclass_id, '00000000-0000-0000-0000-000000000000'::uuid)), chapter_id);

-- 4. Notify
DO $$
BEGIN
    RAISE NOTICE 'Migration 20250126_fix_essence_standalone completed.';
END $$;
