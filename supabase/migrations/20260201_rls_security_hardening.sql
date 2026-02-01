-- ============================================================================
-- Sprint 1: RLS Policy Security Hardening Migration
-- ============================================================================
-- Purpose: Fix 20 "Anonymous Access Policies" warnings from Supabase linter
-- Date: 2026-02-01
-- 
-- STRATEGY:
-- 1. Sensitive tables: Add explicit `auth.uid() IS NOT NULL` checks
-- 2. Public content: Keep anon SELECT for marketing, tighten user-specific
-- 3. Studio tables: Remove overly permissive token policy (admin client handles)
-- ============================================================================

-- ============================================================================
-- SECTION 1: SENSITIVE TABLES (Require Authentication)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 admin_notifications
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access to notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "Service role bypass for notifications" ON public.admin_notifications;

CREATE POLICY "Admin full access to notifications"
ON public.admin_notifications FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND auth.uid() = '4613bce4-5a40-4779-9e87-0def946be940'::uuid
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid() = '4613bce4-5a40-4779-9e87-0def946be940'::uuid
);

-- Note: Service role bypass is implicit (service_role key bypasses RLS entirely)
-- The old policy checking jwt role was redundant and caused linter warnings

-- -----------------------------------------------------------------------------
-- 1.2 purchases
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admins can view all purchases" ON public.purchases;

CREATE POLICY "Users can view their own purchases"
ON public.purchases FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

CREATE POLICY "Admins can view all purchases"
ON public.purchases FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 1.3 user_access_grants
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own grants" ON public.user_access_grants;
DROP POLICY IF EXISTS "Admins can manage grants" ON public.user_access_grants;

CREATE POLICY "Users can view their own grants"
ON public.user_access_grants FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

CREATE POLICY "Admins can manage grants"
ON public.user_access_grants FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 1.4 essence_responses
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own essence responses" ON public.essence_responses;
DROP POLICY IF EXISTS "Users can update own essence responses" ON public.essence_responses;
DROP POLICY IF EXISTS "Admins can view all essence responses" ON public.essence_responses;
DROP POLICY IF EXISTS "Users can insert own essence responses" ON public.essence_responses;

CREATE POLICY "Users can view own essence responses"
ON public.essence_responses FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

CREATE POLICY "Users can insert own essence responses"
ON public.essence_responses FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

CREATE POLICY "Users can update own essence responses"
ON public.essence_responses FOR UPDATE
USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

CREATE POLICY "Admins can view all essence responses"
ON public.essence_responses FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 1.5 user_progress
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own progress." ON public.user_progress;
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;

CREATE POLICY "Users can view own progress"
ON public.user_progress FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

CREATE POLICY "Users can insert own progress"
ON public.user_progress FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

-- -----------------------------------------------------------------------------
-- 1.6 user_questions
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own questions" ON public.user_questions;
DROP POLICY IF EXISTS "Users can insert own questions" ON public.user_questions;
DROP POLICY IF EXISTS "Admins can manage all questions" ON public.user_questions;

CREATE POLICY "Users can view own questions"
ON public.user_questions FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

CREATE POLICY "Users can insert own questions"
ON public.user_questions FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

CREATE POLICY "Admins can manage all questions"
ON public.user_questions FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 1.7 tailor_cards
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own tailor card" ON public.tailor_cards;
DROP POLICY IF EXISTS "Admins can manage all tailor cards" ON public.tailor_cards;

CREATE POLICY "Users can view own tailor card"
ON public.tailor_cards FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
);

CREATE POLICY "Admins can manage all tailor cards"
ON public.tailor_cards FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- SECTION 2: STUDIO TABLES (Remove overly permissive token policy)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 wardrobes - Remove "Upload token access" (admin client handles this)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Upload token access" ON public.wardrobes;

-- Keep existing policies but tighten them
DROP POLICY IF EXISTS "Users can view own wardrobes" ON public.wardrobes;
DROP POLICY IF EXISTS "Admin full access to wardrobes" ON public.wardrobes;

CREATE POLICY "Users can view own wardrobes"
ON public.wardrobes FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND owner_id = auth.uid()
);

CREATE POLICY "Admin full access to wardrobes"
ON public.wardrobes FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 2.2 wardrobe_items
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Admins can manage all wardrobe items" ON public.wardrobe_items;

CREATE POLICY "Users can view own wardrobe items"
ON public.wardrobe_items FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND (
        user_id = auth.uid() 
        OR wardrobe_id IN (
            SELECT id FROM public.wardrobes WHERE owner_id = auth.uid()
        )
    )
);

CREATE POLICY "Admins can manage all wardrobe items"
ON public.wardrobe_items FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 2.3 lookbooks
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their published lookbooks" ON public.lookbooks;
DROP POLICY IF EXISTS "Admins can manage all lookbooks" ON public.lookbooks;

CREATE POLICY "Users can view their published lookbooks"
ON public.lookbooks FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND (
        user_id = auth.uid() 
        OR wardrobe_id IN (
            SELECT id FROM public.wardrobes WHERE owner_id = auth.uid()
        )
    )
    AND status = 'Published'
);

CREATE POLICY "Admins can manage all lookbooks"
ON public.lookbooks FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 2.4 lookbook_items
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view items in their lookbooks" ON public.lookbook_items;
DROP POLICY IF EXISTS "Admins can manage all lookbook items" ON public.lookbook_items;

CREATE POLICY "Users can view items in their lookbooks"
ON public.lookbook_items FOR SELECT
USING (
    auth.uid() IS NOT NULL 
    AND lookbook_id IN (
        SELECT id FROM public.lookbooks 
        WHERE user_id = auth.uid() 
        OR wardrobe_id IN (
            SELECT id FROM public.wardrobes WHERE owner_id = auth.uid()
        )
    )
);

CREATE POLICY "Admins can manage all lookbook items"
ON public.lookbook_items FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- SECTION 3: PROFILES - Tighten update policies
-- ============================================================================

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

-- Keep public read for display names (needed for UI)
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Users can only update their own profile when authenticated
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (
    auth.uid() IS NOT NULL 
    AND id = auth.uid()
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND id = auth.uid()
);

-- Admin management
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admins can delete any profile"
ON public.profiles FOR DELETE
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- SECTION 4: PUBLIC CONTENT (Keep anon SELECT, tighten admin operations)
-- ============================================================================
-- These tables INTENTIONALLY allow anonymous SELECT for marketing/public pages
-- We only tighten the admin mutation policies

-- -----------------------------------------------------------------------------
-- 4.1 chapters
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admins can manage chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admins can update chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admins can delete chapters" ON public.chapters;

-- Public read is intentional
CREATE POLICY "Anyone can view chapters"
ON public.chapters FOR SELECT
USING (true);

-- Admin mutations require auth
CREATE POLICY "Admins can manage chapters"
ON public.chapters FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 4.2 masterclasses
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view masterclasses" ON public.masterclasses;
DROP POLICY IF EXISTS "Admins can manage masterclasses" ON public.masterclasses;
DROP POLICY IF EXISTS "Admins can update masterclasses" ON public.masterclasses;
DROP POLICY IF EXISTS "Admins can delete masterclasses" ON public.masterclasses;

CREATE POLICY "Anyone can view masterclasses"
ON public.masterclasses FOR SELECT
USING (true);

CREATE POLICY "Admins can manage masterclasses"
ON public.masterclasses FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 4.3 services
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read services" ON public.services;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Admins can update services" ON public.services;
DROP POLICY IF EXISTS "Admins can delete services" ON public.services;

CREATE POLICY "Public read services"
ON public.services FOR SELECT
USING (true);

CREATE POLICY "Admins can manage services"
ON public.services FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 4.4 offers
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read active offers" ON public.offers;
DROP POLICY IF EXISTS "Admins can manage offers" ON public.offers;

CREATE POLICY "Public read active offers"
ON public.offers FOR SELECT
USING (active = true);

CREATE POLICY "Admins can manage offers"
ON public.offers FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 4.5 boutique_items
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public view items" ON public.boutique_items;
DROP POLICY IF EXISTS "Admins manage items" ON public.boutique_items;

CREATE POLICY "Public view items"
ON public.boutique_items FOR SELECT
USING (active = true);

CREATE POLICY "Admins manage items"
ON public.boutique_items FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- -----------------------------------------------------------------------------
-- 4.6 partner_brands
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public view brands" ON public.partner_brands;
DROP POLICY IF EXISTS "Admins manage brands" ON public.partner_brands;

CREATE POLICY "Public view brands"
ON public.partner_brands FOR SELECT
USING (active = true);

CREATE POLICY "Admins manage brands"
ON public.partner_brands FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
