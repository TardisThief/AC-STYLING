
-- Create user_questions table
CREATE TABLE IF NOT EXISTS public.user_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'read')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can see their own questions
CREATE POLICY "Users can view own questions"
ON public.user_questions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own questions
CREATE POLICY "Users can insert own questions"
ON public.user_questions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all questions (Assuming admin check via service role or admin flag, 
-- but for now we'll rely on the dashboard using service role client or logic)
-- Actually, let's allow all authenticated users to insert, but only admins to update answer.
-- Since we often use service role for admin actions in this app (based on previous context), 
-- standard RLS might mask this if we don't grant specific admin access.
-- But let's add a policy for admins if you have an is_admin flag or similar, 
-- or just rely on the admin client used in `actions/admin/*`.

-- For now, let's keep it simple: Users own their rows. 
-- Admin actions likely use `createAdminClient` which bypasses RLS.

-- Indexes
CREATE INDEX idx_user_questions_user_id ON public.user_questions(user_id);
CREATE INDEX idx_user_questions_status ON public.user_questions(status);
