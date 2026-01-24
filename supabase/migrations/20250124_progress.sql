-- Create a table for user progress
create table user_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  content_id text not null, -- e.g., 'foundations/dna'
  completed_at timestamp with time zone default now(),
  
  unique(user_id, content_id) -- Prevent duplicate completions
);

-- RLS
alter table user_progress enable row level security;

create policy "Users can view own progress."
  on user_progress for select
  using ( (select auth.uid()) = user_id );

create policy "Users can update own progress."
  on user_progress for insert
  with check ( (select auth.uid()) = user_id );

-- Index for faster lookups
create index idx_user_progress_user_id on user_progress(user_id);
