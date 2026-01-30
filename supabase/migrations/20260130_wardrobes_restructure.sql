-- Wardrobe Entity Restructure Migration
-- This migration creates the wardrobes table as a first-class entity
-- and migrates existing wardrobe_items from user-based to wardrobe-based structure

-- ============================================================================
-- STEP 1: Create the wardrobes table
-- ============================================================================

CREATE TABLE IF NOT EXISTS wardrobes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership (NULL = unclaimed/admin-managed)
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Display
    title TEXT NOT NULL DEFAULT 'My Wardrobe',
    
    -- Direct upload token (for sharing upload links)
    upload_token UUID UNIQUE DEFAULT gen_random_uuid(),
    
    -- State
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wardrobes_owner ON wardrobes(owner_id);
CREATE INDEX IF NOT EXISTS idx_wardrobes_upload_token ON wardrobes(upload_token);
CREATE INDEX IF NOT EXISTS idx_wardrobes_status ON wardrobes(status);

-- RLS
ALTER TABLE wardrobes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own wardrobes
CREATE POLICY "Users can view own wardrobes"
ON wardrobes FOR SELECT
USING (owner_id = auth.uid());

-- Policy: Admin can do everything
CREATE POLICY "Admin full access to wardrobes"
ON wardrobes FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- Policy: Anyone with upload_token can view (for guest uploads)
CREATE POLICY "Upload token access"
ON wardrobes FOR SELECT
USING (upload_token IS NOT NULL);

-- ============================================================================
-- STEP 2: Add wardrobe_id column to wardrobe_items (alongside existing user_id)
-- ============================================================================

ALTER TABLE wardrobe_items 
ADD COLUMN IF NOT EXISTS wardrobe_id UUID REFERENCES wardrobes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_wardrobe ON wardrobe_items(wardrobe_id);

-- ============================================================================
-- STEP 3: Migrate existing data - Create wardrobes for each user with items
-- ============================================================================

-- For each distinct user_id in wardrobe_items, create a wardrobe and link items
DO $$
DECLARE
    r RECORD;
    new_wardrobe_id UUID;
BEGIN
    -- Loop through each user who has wardrobe items
    FOR r IN 
        SELECT DISTINCT user_id 
        FROM wardrobe_items 
        WHERE user_id IS NOT NULL AND wardrobe_id IS NULL
    LOOP
        -- Create a wardrobe for this user
        INSERT INTO wardrobes (owner_id, title)
        VALUES (r.user_id, 'My Wardrobe')
        RETURNING id INTO new_wardrobe_id;
        
        -- Update all their items to point to this wardrobe
        UPDATE wardrobe_items 
        SET wardrobe_id = new_wardrobe_id 
        WHERE user_id = r.user_id AND wardrobe_id IS NULL;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Update lookbooks to reference wardrobes instead of users
-- ============================================================================

ALTER TABLE lookbooks 
ADD COLUMN IF NOT EXISTS wardrobe_id UUID REFERENCES wardrobes(id) ON DELETE CASCADE;

-- Migrate lookbooks to their user's wardrobe
UPDATE lookbooks 
SET wardrobe_id = (
    SELECT w.id FROM wardrobes w WHERE w.owner_id = lookbooks.user_id LIMIT 1
)
WHERE wardrobe_id IS NULL AND user_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Keep user_id columns for now (backward compatibility)
-- We'll drop them in a future migration after code is updated
-- ============================================================================

COMMENT ON COLUMN wardrobe_items.user_id IS 'DEPRECATED: Use wardrobe_id instead. Will be removed in future migration.';
COMMENT ON COLUMN lookbooks.user_id IS 'DEPRECATED: Use wardrobe_id instead. Will be removed in future migration.';

-- ============================================================================
-- DONE: wardrobes table created, existing data migrated
-- ============================================================================
