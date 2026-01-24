-- Add role column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  video_id TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT DEFAULT 'masterclass' CHECK (category IN ('masterclass', 'course')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lesson_metadata table
CREATE TABLE IF NOT EXISTS lesson_metadata (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id uuid REFERENCES chapters(id) ON DELETE CASCADE,
  lab_questions JSONB DEFAULT '[]'::jsonb,
  takeaways JSONB DEFAULT '[]'::jsonb,
  resource_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chapter_id)
);

-- Enable RLS
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chapters (public read, admin write)
CREATE POLICY "Anyone can view chapters"
  ON chapters FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert chapters"
  ON chapters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update chapters"
  ON chapters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete chapters"
  ON chapters FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for lesson_metadata (same as chapters)
CREATE POLICY "Anyone can view lesson metadata"
  ON lesson_metadata FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert lesson metadata"
  ON lesson_metadata FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update lesson metadata"
  ON lesson_metadata FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete lesson metadata"
  ON lesson_metadata FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chapters_slug ON chapters(slug);
CREATE INDEX IF NOT EXISTS idx_chapters_order ON chapters(order_index);
CREATE INDEX IF NOT EXISTS idx_lesson_metadata_chapter ON lesson_metadata(chapter_id);
