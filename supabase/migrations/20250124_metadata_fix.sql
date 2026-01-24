-- Ensure UNIQUE constraint on chapter_id if not already present
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_metadata_chapter_id_key') THEN
        ALTER TABLE public.lesson_metadata ADD CONSTRAINT lesson_metadata_chapter_id_key UNIQUE (chapter_id);
    END IF;
END $$;

-- Enable RLS if not enabled
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_metadata ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policies to avoid duplicates
DROP POLICY IF EXISTS "Anyone can view chapters" ON public.chapters;
DROP POLICY IF EXISTS "Anyone can view lesson metadata" ON public.lesson_metadata;

-- Create SELECT policies for public viewing
CREATE POLICY "Anyone can view chapters"
ON public.chapters FOR SELECT
USING (true);

CREATE POLICY "Anyone can view lesson metadata"
ON public.lesson_metadata FOR SELECT
USING (true);

-- Ensure admin policies are robust
DROP POLICY IF EXISTS "Admins can manage chapters" ON public.chapters;
CREATE POLICY "Admins can manage chapters"
ON public.chapters FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can manage lesson metadata" ON public.lesson_metadata;
CREATE POLICY "Admins can manage lesson metadata"
ON public.lesson_metadata FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Grant permissions to public/authenticated
GRANT SELECT ON public.chapters TO anon, authenticated;
GRANT SELECT ON public.lesson_metadata TO anon, authenticated;
GRANT ALL ON public.chapters TO authenticated;
GRANT ALL ON public.lesson_metadata TO authenticated;
