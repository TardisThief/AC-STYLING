-- Admin Notifications System Migration
-- Creates the admin_notifications table for service bookings, sales, and future notification types

CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Notification Type (extensible for future types)
    type TEXT NOT NULL, -- 'service_booking', 'masterclass_purchase', 'sale', etc.
    
    -- Core Data
    title TEXT NOT NULL,
    message TEXT, -- Detailed message body
    
    -- Linkage
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- The client this notification relates to
    reference_id TEXT, -- External reference (Stripe session ID, purchase ID, etc.)
    
    -- State Machine
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'actioned', 'archived')),
    action_taken TEXT, -- e.g., 'scheduled', 'completed', 'refunded'
    
    -- Metadata (flexible for different notification types)
    metadata JSONB DEFAULT '{}'::JSONB -- { amount, currency, phone, email, service_title, etc. }
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);

-- RLS: Only admins can access (Ale's user_id)
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admin can do everything (using hardcoded Ale's ID to avoid auth.users query)
CREATE POLICY "Admin full access to notifications"
ON admin_notifications
FOR ALL
USING (auth.uid() = '4613bce4-5a40-4779-9e87-0def946be940'::uuid)
WITH CHECK (auth.uid() = '4613bce4-5a40-4779-9e87-0def946be940'::uuid);

-- Service role bypass for webhooks
CREATE POLICY "Service role bypass for notifications"
ON admin_notifications
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');
