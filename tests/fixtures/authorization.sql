-- Minimal authorization fixture from the live 2026-09-19 schema. Synthetic data only.
-- Auth helpers simulate PostgREST claims; PostgreSQL itself enforces grants/RLS.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid() PRIMARY KEY,bucket_id text,name text);
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    username text,
    website text,
    avatar_url text,
    language_preference text DEFAULT 'en'::text,
    style_essentials jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone,
    role text DEFAULT 'user'::text,
    created_at timestamp with time zone DEFAULT now(),
    email text,
    is_guest boolean DEFAULT false,
    intake_token uuid,
    converted_at timestamp with time zone,
    studio_permissions jsonb DEFAULT '{"lookbook": false, "wardrobe": false}'::jsonb,
    status text DEFAULT 'active'::text,
    has_full_unlock boolean DEFAULT false,
    has_course_pass boolean DEFAULT false,
    active_studio_client boolean DEFAULT false,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text]))),
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text]))),
    CONSTRAINT username_length CHECK ((char_length(username) >= 3))
);
CREATE TABLE public.boutique_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    title_es text,
    description text,
    description_es text,
    cover_image_url text,
    active boolean DEFAULT true NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.boutique_collection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    item_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.boutique_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    user_id uuid,
    locale text DEFAULT 'en'::text NOT NULL,
    clicked_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.rate_limits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.profiles ADD PRIMARY KEY (id);
ALTER TABLE public.boutique_collections ADD PRIMARY KEY (id);
ALTER TABLE public.boutique_collection_items ADD PRIMARY KEY (id);
ALTER TABLE public.boutique_clicks ADD PRIMARY KEY (id);
ALTER TABLE public.rate_limits ADD PRIMARY KEY (key);
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = user_id;
$function$
;
CREATE OR REPLACE FUNCTION public.clone_lookbook(lookbook_id uuid, target_profile_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    new_lookbook_id UUID;
    item_record RECORD;
    new_item_id UUID;
    original_item_owner UUID;
BEGIN
    -- 1. Get original lookbook owner to check if we need to clone items too
    SELECT user_id INTO original_item_owner FROM public.lookbooks WHERE id = lookbook_id;

    -- 2. Create the new lookbook
    INSERT INTO public.lookbooks (
        user_id, title, collection_name, status, metadata
    )
    SELECT
        target_profile_id,
        title || ' (Copy)',
        collection_name,
        'Draft', -- Reset to draft
        metadata
    FROM public.lookbooks
    WHERE id = lookbook_id
    RETURNING id INTO new_lookbook_id;

    -- 3. Clone items and link them
    -- We assume lookbooks largely consist of items we want to copy into the new user's wardrobe (e.g. from Warehouse)
    
    FOR item_record IN 
        SELECT li.item_id, li.position
        FROM public.lookbook_items li
        WHERE li.lookbook_id = lookbook_id
    LOOP
        -- Clone item to new user
        new_item_id := public.clone_wardrobe_item(item_record.item_id, target_profile_id);
        
        -- Link new item to new lookbook
        INSERT INTO public.lookbook_items (lookbook_id, item_id, position)
        VALUES (new_lookbook_id, new_item_id, item_record.position);
        
    END LOOP;

    RETURN new_lookbook_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.clone_wardrobe_item(item_id uuid, target_profile_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    new_item_id UUID;
BEGIN
    INSERT INTO public.wardrobe_items (
        user_id, image_url, category, client_note, internal_note, status, product_link_id, is_general_library
    )
    SELECT
        target_profile_id, -- New owner
        image_url,
        category,
        client_note,
        internal_note,
        'Keep', -- Default status for cloned items
        product_link_id,
        FALSE -- Cloned items are specific to the client, not general library (unless specified otherwise)
    FROM public.wardrobe_items
    WHERE id = item_id
    RETURNING id INTO new_item_id;

    RETURN new_item_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window interval)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limits (key, count, window_start)
    VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limits.window_start < now() - p_window THEN 1
      ELSE public.rate_limits.count + 1
    END,
    window_start = CASE
      WHEN public.rate_limits.window_start < now() - p_window THEN now()
      ELSE public.rate_limits.window_start
    END
  RETURNING count INTO v_count;

  -- Allowed when this request is within the max for the current window.
  RETURN v_count <= p_max;
END;
$function$
;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public, storage TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
CREATE POLICY "boutique_clicks: admin read" ON public.boutique_clicks FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "boutique_clicks: anon insert" ON public.boutique_clicks FOR INSERT TO public WITH CHECK ((user_id IS NULL));
CREATE POLICY "boutique_clicks: authenticated insert" ON public.boutique_clicks FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "boutique_collection_items: admin write" ON public.boutique_collection_items FOR ALL TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "boutique_collection_items: authenticated read" ON public.boutique_collection_items FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "boutique_collections: admin write" ON public.boutique_collections FOR ALL TO public USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "boutique_collections: authenticated read" ON public.boutique_collections FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE TO public USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text))))));
CREATE POLICY "Admins can insert any profile" ON public.profiles FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text)))));
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO public USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text))))));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO public USING (((auth.uid() IS NOT NULL) AND (get_user_role(auth.uid()) = 'admin'::text)));
CREATE POLICY "Service role can insert profile" ON public.profiles FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO public WITH CHECK (((auth.uid() IS NOT NULL) AND (id = auth.uid())));
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT TO public WITH CHECK ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO public USING (((auth.uid() IS NOT NULL) AND (id = auth.uid()))) WITH CHECK (((auth.uid() IS NOT NULL) AND (id = auth.uid())));
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO public USING (((auth.uid() IS NOT NULL) AND (id = auth.uid())));
CREATE POLICY "Admin All Access" ON storage.objects FOR ALL TO public USING (((bucket_id = 'boutique'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((bucket_id = 'boutique'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));
CREATE POLICY "Admins can upload assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'vault-assets'::text));
CREATE POLICY "Anyone can upload an avatar." ON storage.objects FOR INSERT TO public WITH CHECK ((bucket_id = 'avatars'::text));
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT TO public USING ((bucket_id = 'avatars'::text));
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING ((bucket_id = 'boutique'::text));
