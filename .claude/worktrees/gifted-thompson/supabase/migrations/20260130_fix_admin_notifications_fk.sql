-- Fix Admin Notifications Foreign Key
-- Changes the foreign key from auth.users to public.profiles
-- This resolves the "permission denied for table users" RLS error

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE admin_notifications
DROP CONSTRAINT IF EXISTS admin_notifications_user_id_fkey;

-- Step 2: Add new foreign key referencing profiles table
ALTER TABLE admin_notifications
ADD CONSTRAINT admin_notifications_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Note: This works because profiles.id is synced with auth.users.id
-- but profiles has proper RLS policies for read access
