-- 1. Ensure the Trigger Function exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_username text;
  pf_exists boolean;
BEGIN
  -- Check if profile already exists to avoid PK violation
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) INTO pf_exists;
  IF pf_exists THEN
    RETURN new;
  END IF;

  -- Generate a username if not provided in metadata
  new_username := new.raw_user_meta_data->>'username';
  
  -- Fallback 1: Use email prefix (cleaned)
  IF new_username IS NULL OR length(new_username) < 3 THEN
    new_username := split_part(new.email, '@', 1);
    -- Ensure min length 3 by appending random chars if needed
    IF length(new_username) < 3 THEN
         new_username := new_username || '_' || floor(random() * 1000)::text;
    END IF;
  END IF;

  -- Fallback 2: Collision handling (basic) - if name taken, append random
  -- (Ideally we'd do a loop, but simple append is usually enough for low volume)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) THEN
     new_username := new_username || '_' || floor(random() * 1000)::text;
  END IF;

  INSERT INTO public.profiles (id, full_name, username, avatar_url, email, role, language_preference)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New Stylist'),
    new_username,
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::text, 'user'), -- Safe cast
    COALESCE(new.raw_user_meta_data->>'language', 'en')
  );
  
  RETURN new;
END;
$$;

-- 2. Ensure Trigger is Bound
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. HEAL: Backfill missing profiles
-- This finds users in auth.users that have NO matching record in public.profiles
INSERT INTO public.profiles (id, full_name, username, avatar_url, email, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', 'Restored User'),
  -- Username generation logic for backfill
  CASE 
     WHEN length(split_part(au.email, '@', 1)) >= 3 THEN split_part(au.email, '@', 1) 
     ELSE split_part(au.email, '@', 1) || '_' || substr(md5(random()::text), 1, 4)
  END as username,
  au.raw_user_meta_data->>'avatar_url',
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'user')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- 4. Verify
SELECT count(*) as profiles_created_count FROM public.profiles;
