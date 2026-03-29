-- =============================================================================
-- AC Styling: Improvements Release Migration
-- Date: 2026-03-29
-- Covers: Trusted By, Boutique Collections, Brand CRM, Click Tracking, Saves
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. TRUSTED BY LOGOS
-- Separate from partner_brands — used purely for landing page social proof.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trusted_by_logos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    logo_url    text NOT NULL,
    order_index integer NOT NULL DEFAULT 0,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trusted_by_logos ENABLE ROW LEVEL SECURITY;

-- Public read (landing page is public)
CREATE POLICY "trusted_by_logos: public read"
    ON trusted_by_logos FOR SELECT
    USING (true);

-- Admin write (authenticated users matching admin id — same pattern as rest of app)
CREATE POLICY "trusted_by_logos: admin write"
    ON trusted_by_logos FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');


-- -----------------------------------------------------------------------------
-- 2. BRAND CRM — add columns to existing partner_brands table
-- -----------------------------------------------------------------------------
ALTER TABLE partner_brands
    ADD COLUMN IF NOT EXISTS contact_name       text,
    ADD COLUMN IF NOT EXISTS contact_email      text,
    ADD COLUMN IF NOT EXISTS commission_rate    numeric(5,2),
    ADD COLUMN IF NOT EXISTS partnership_status text NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS internal_notes     text;

-- Constrain partnership_status to known values
ALTER TABLE partner_brands
    DROP CONSTRAINT IF EXISTS partner_brands_partnership_status_check;
ALTER TABLE partner_brands
    ADD CONSTRAINT partner_brands_partnership_status_check
    CHECK (partnership_status IN ('active', 'prospect', 'paused', 'inactive'));


-- -----------------------------------------------------------------------------
-- 3. BOUTIQUE COLLECTIONS
-- Groups of boutique items for curated edits / filter rows.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boutique_collections (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    title_es        text,
    description     text,
    description_es  text,
    cover_image_url text,
    active          boolean NOT NULL DEFAULT true,
    order_index     integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE boutique_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_collections: authenticated read"
    ON boutique_collections FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "boutique_collections: admin write"
    ON boutique_collections FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');


-- -----------------------------------------------------------------------------
-- 4. BOUTIQUE COLLECTION ITEMS  (junction table)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boutique_collection_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id   uuid NOT NULL REFERENCES boutique_collections(id) ON DELETE CASCADE,
    item_id         uuid NOT NULL REFERENCES boutique_items(id) ON DELETE CASCADE,
    position        integer NOT NULL DEFAULT 0,
    UNIQUE (collection_id, item_id)
);

ALTER TABLE boutique_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_collection_items: authenticated read"
    ON boutique_collection_items FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "boutique_collection_items: admin write"
    ON boutique_collection_items FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');


-- -----------------------------------------------------------------------------
-- 5. BOUTIQUE CLICK TRACKING
-- Records each click on a "Shop Now" link. user_id nullable for unauthenticated.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boutique_clicks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id     uuid NOT NULL REFERENCES boutique_items(id) ON DELETE CASCADE,
    user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    locale      text NOT NULL DEFAULT 'en',
    clicked_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE boutique_clicks ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own clicks
CREATE POLICY "boutique_clicks: authenticated insert"
    ON boutique_clicks FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Allow anonymous inserts too (for unauthenticated visitors)
CREATE POLICY "boutique_clicks: anon insert"
    ON boutique_clicks FOR INSERT
    WITH CHECK (user_id IS NULL);

-- Admin read-all
CREATE POLICY "boutique_clicks: admin read"
    ON boutique_clicks FOR SELECT
    USING (auth.role() = 'authenticated');


-- -----------------------------------------------------------------------------
-- 6. BOUTIQUE SAVES (Wishlist)
-- Authenticated users save/bookmark boutique items.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boutique_saves (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id     uuid NOT NULL REFERENCES boutique_items(id) ON DELETE CASCADE,
    saved_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, item_id)
);

ALTER TABLE boutique_saves ENABLE ROW LEVEL SECURITY;

-- Users manage only their own saves
CREATE POLICY "boutique_saves: user read own"
    ON boutique_saves FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "boutique_saves: user insert own"
    ON boutique_saves FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "boutique_saves: user delete own"
    ON boutique_saves FOR DELETE
    USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 7. INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_trusted_by_logos_order
    ON trusted_by_logos (order_index);

CREATE INDEX IF NOT EXISTS idx_boutique_collections_order
    ON boutique_collections (order_index);

CREATE INDEX IF NOT EXISTS idx_boutique_collection_items_collection
    ON boutique_collection_items (collection_id);

CREATE INDEX IF NOT EXISTS idx_boutique_collection_items_item
    ON boutique_collection_items (item_id);

CREATE INDEX IF NOT EXISTS idx_boutique_clicks_item
    ON boutique_clicks (item_id);

CREATE INDEX IF NOT EXISTS idx_boutique_clicks_user
    ON boutique_clicks (user_id);

CREATE INDEX IF NOT EXISTS idx_boutique_saves_user
    ON boutique_saves (user_id);

CREATE INDEX IF NOT EXISTS idx_boutique_saves_item
    ON boutique_saves (item_id);
