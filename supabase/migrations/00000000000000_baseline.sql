-- =====================================================================
-- BASELINE SCHEMA SNAPSHOT — public schema
-- =====================================================================
-- Machine-generated with pg_dump --schema-only --schema=public against the
-- live Supabase project (vitrtidtvkdoghcwgxjl), 2026-07-10.
--
-- Purpose: version-controlled source of truth for the database structure —
-- tables, RLS policies, triggers, functions, grants. Enables drift detection,
-- code review of schema changes, and disaster recovery.
--
-- This is the CURRENT state, captured AFTER change-migrations 01-05 were
-- applied, so it intentionally overlaps with them (e.g. the hardened
-- handle_new_user, the partner_brands column grants, the rate_limits and
-- stripe_processed_events tables all appear here). The dated 20260710_0N_*.sql
-- files remain the reviewable changelog of how the security posture got here.
--
-- Scope: public schema only. The auth trigger (handle_new_user) and the
-- studio-wardrobe storage policies also live in migrations 01 and 03.
--
-- NOT auto-applied. Replay with psql if ever rebuilding from scratch.
-- =====================================================================

--
-- PostgreSQL database dump
--

\restrict SZT0He1O431zs4IaoM6gfRiGxmE4hhFRUiBGBIKPAF4aIYZRkfQ12wOgroFuRgk

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: check_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_access(check_user_id uuid, check_object_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE

    user_profile public.profiles%ROWTYPE;

    is_standalone_course boolean;

    parent_masterclass_id uuid;

BEGIN

    -- 1. Fetch User Profile

    SELECT * INTO user_profile FROM public.profiles WHERE id = check_user_id;

    IF user_profile IS NULL THEN RETURN false; END IF;



    -- 2. Global Overrides

    IF user_profile.role = 'admin' OR user_profile.has_full_unlock THEN RETURN true; END IF;



    -- 3. Course Pass Logic

    IF user_profile.has_course_pass THEN

        SELECT EXISTS (SELECT 1 FROM public.chapters WHERE id = check_object_id AND is_standalone = true) INTO is_standalone_course;

        IF is_standalone_course THEN RETURN true; END IF;

    END IF;



    -- 4. Direct Grant Check

    IF EXISTS (SELECT 1 FROM public.user_access_grants WHERE user_id = check_user_id AND (masterclass_id = check_object_id OR chapter_id = check_object_id)) THEN RETURN true; END IF;



    -- 5. Parent Masterclass Check (Inheritance)

    SELECT masterclass_id INTO parent_masterclass_id FROM public.chapters WHERE id = check_object_id;

    

    IF parent_masterclass_id IS NOT NULL THEN

        IF EXISTS (SELECT 1 FROM public.user_access_grants WHERE user_id = check_user_id AND masterclass_id = parent_masterclass_id) THEN

            RETURN true;

        END IF;

    END IF;



    RETURN false;

END;

$$;


ALTER FUNCTION public.check_access(check_user_id uuid, check_object_id uuid) OWNER TO postgres;

--
-- Name: check_rate_limit(text, integer, interval); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window interval) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

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

$$;


ALTER FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window interval) OWNER TO postgres;

--
-- Name: check_wardrobe_eligibility(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_wardrobe_eligibility() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    -- Check if the user is an active studio client

    -- We assume the 'profiles' table is the source of truth

    IF NOT EXISTS (

        SELECT 1 FROM public.profiles

        WHERE id = NEW.user_id

        AND active_studio_client = TRUE

    ) THEN

        -- Block creation silently (return NULL cancels the insert in BEFORE trigger)

        -- This prevents errors in the signup flow if some legacy logic tries to create it.

        RETURN NULL; 

    END IF;



    RETURN NEW;

END;

$$;


ALTER FUNCTION public.check_wardrobe_eligibility() OWNER TO postgres;

--
-- Name: clone_lookbook(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.clone_lookbook(lookbook_id uuid, target_profile_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

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

$$;


ALTER FUNCTION public.clone_lookbook(lookbook_id uuid, target_profile_id uuid) OWNER TO postgres;

--
-- Name: clone_wardrobe_item(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.clone_wardrobe_item(item_id uuid, target_profile_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

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

$$;


ALTER FUNCTION public.clone_wardrobe_item(item_id uuid, target_profile_id uuid) OWNER TO postgres;

--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_role(user_id uuid) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

  SELECT role FROM public.profiles WHERE id = user_id;

$$;


ALTER FUNCTION public.get_user_role(user_id uuid) OWNER TO postgres;

--
-- Name: handle_new_purchase(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_purchase() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE

    service_unlocks BOOLEAN;

BEGIN

    SELECT unlocks_studio_access INTO service_unlocks

    FROM public.services

    WHERE price_id = NEW.product_id

    LIMIT 1;



    IF service_unlocks = TRUE THEN

        UPDATE public.profiles

        SET 

            active_studio_client = TRUE,

            studio_permissions = jsonb_set(

                jsonb_set(

                    COALESCE(studio_permissions, '{}'::jsonb),

                    '{lookbook}', 'true'

                ),

                '{wardrobe}', 'true'

            )

        WHERE id = NEW.user_id;



        INSERT INTO public.tailor_cards (user_id)

        VALUES (NEW.user_id)

        ON CONFLICT (user_id) DO NOTHING;

    END IF;



    RETURN NEW;

END;

$$;


ALTER FUNCTION public.handle_new_purchase() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

DECLARE

  new_username text;

  pf_exists boolean;

BEGIN

  -- Skip if a profile already exists (avoid PK violation).

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) INTO pf_exists;

  IF pf_exists THEN

    RETURN new;

  END IF;



  new_username := new.raw_user_meta_data->>'username';



  IF new_username IS NULL OR length(new_username) < 3 THEN

    new_username := split_part(new.email, '@', 1);

    IF length(new_username) < 3 THEN

      new_username := new_username || '_' || floor(random() * 1000)::text;

    END IF;

  END IF;



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

    'user', -- SECURITY: never trust client-supplied role metadata.

    COALESCE(new.raw_user_meta_data->>'language', 'en')

  );



  RETURN new;

END;

$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$

BEGIN

    NEW.updated_at = NOW();

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.handle_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    type text NOT NULL,
    title text NOT NULL,
    message text,
    user_id uuid,
    reference_id text,
    status text DEFAULT 'unread'::text,
    action_taken text,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT admin_notifications_status_check CHECK ((status = ANY (ARRAY['unread'::text, 'read'::text, 'actioned'::text, 'archived'::text])))
);


ALTER TABLE public.admin_notifications OWNER TO postgres;

--
-- Name: boutique_clicks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boutique_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    user_id uuid,
    locale text DEFAULT 'en'::text NOT NULL,
    clicked_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.boutique_clicks OWNER TO postgres;

--
-- Name: boutique_collection_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boutique_collection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    item_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.boutique_collection_items OWNER TO postgres;

--
-- Name: boutique_collections; Type: TABLE; Schema: public; Owner: postgres
--

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


ALTER TABLE public.boutique_collections OWNER TO postgres;

--
-- Name: boutique_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boutique_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid,
    name text NOT NULL,
    image_url text NOT NULL,
    curator_note text,
    affiliate_url_usa text,
    affiliate_url_es text,
    category text,
    order_index integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    curator_note_es text
);


ALTER TABLE public.boutique_items OWNER TO postgres;

--
-- Name: boutique_saves; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boutique_saves (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.boutique_saves OWNER TO postgres;

--
-- Name: chapters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text,
    video_id text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    category text DEFAULT 'masterclass'::text,
    subtitle text,
    thumbnail_url text,
    lab_questions jsonb DEFAULT '[]'::jsonb,
    takeaways jsonb DEFAULT '[]'::jsonb,
    resource_urls jsonb DEFAULT '[]'::jsonb,
    masterclass_id uuid,
    is_standalone boolean DEFAULT true,
    video_id_es text,
    stripe_product_id text,
    price_id text,
    title_es text,
    subtitle_es text,
    description_es text,
    takeaways_es jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT chapters_category_check CHECK ((category = ANY (ARRAY['masterclass'::text, 'course'::text])))
);


ALTER TABLE public.chapters OWNER TO postgres;

--
-- Name: essence_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.essence_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    masterclass_id uuid,
    chapter_slug text,
    question_key text NOT NULL,
    answer_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    context_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    chapter_id uuid
);


ALTER TABLE public.essence_responses OWNER TO postgres;

--
-- Name: lookbook_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lookbook_items (
    lookbook_id uuid NOT NULL,
    item_id uuid NOT NULL,
    "position" integer DEFAULT 0
);


ALTER TABLE public.lookbook_items OWNER TO postgres;

--
-- Name: lookbooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lookbooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    collection_name text,
    status text DEFAULT 'Published'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    wardrobe_id uuid,
    CONSTRAINT lookbooks_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Published'::text])))
);


ALTER TABLE public.lookbooks OWNER TO postgres;

--
-- Name: COLUMN lookbooks.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.lookbooks.user_id IS 'DEPRECATED: Use wardrobe_id instead. Will be removed in future migration.';


--
-- Name: masterclasses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.masterclasses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text,
    description text,
    thumbnail_url text,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    stripe_product_id text,
    price_id text,
    title_es text,
    subtitle_es text,
    description_es text,
    takeaways_es jsonb DEFAULT '[]'::jsonb,
    video_url text
);


ALTER TABLE public.masterclasses OWNER TO postgres;

--
-- Name: offers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text,
    price_display text,
    stripe_product_id text,
    price_id text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    title_es text,
    description_es text
);


ALTER TABLE public.offers OWNER TO postgres;

--
-- Name: partner_brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partner_brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    logo_url text,
    website_url text,
    order_index integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contact_name text,
    contact_email text,
    commission_rate numeric(5,2),
    partnership_status text DEFAULT 'active'::text NOT NULL,
    internal_notes text,
    CONSTRAINT partner_brands_partnership_status_check CHECK ((partnership_status = ANY (ARRAY['active'::text, 'prospect'::text, 'paused'::text, 'inactive'::text])))
);


ALTER TABLE public.partner_brands OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

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


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0.00,
    currency text DEFAULT 'USD'::text,
    status text DEFAULT 'completed'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchases_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'refunded'::text])))
);


ALTER TABLE public.purchases OWNER TO postgres;

--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_limits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rate_limits OWNER TO postgres;

--
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text,
    description text,
    price_display text,
    price_id text,
    stripe_url text,
    image_url text,
    type text DEFAULT 'session'::text,
    recommendation_tags text[] DEFAULT '{}'::text[],
    active boolean DEFAULT true,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    unlocks_studio_access boolean DEFAULT false,
    stripe_product_id text,
    title_es text,
    subtitle_es text,
    description_es text,
    CONSTRAINT services_type_check CHECK ((type = ANY (ARRAY['session'::text, 'retainer'::text])))
);


ALTER TABLE public.services OWNER TO postgres;

--
-- Name: stripe_processed_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stripe_processed_events (
    event_id text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stripe_processed_events OWNER TO postgres;

--
-- Name: tailor_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tailor_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    measurements jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tailor_cards OWNER TO postgres;

--
-- Name: trusted_by_logos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trusted_by_logos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    logo_url text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.trusted_by_logos OWNER TO postgres;

--
-- Name: user_access_grants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_access_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    masterclass_id uuid,
    chapter_id uuid,
    granted_at timestamp with time zone DEFAULT now(),
    grant_type text DEFAULT 'purchase'::text,
    CONSTRAINT user_access_grants_grant_type_check CHECK ((grant_type = ANY (ARRAY['purchase'::text, 'bonus'::text, 'admin_override'::text]))),
    CONSTRAINT valid_grant_target CHECK (((masterclass_id IS NOT NULL) OR (chapter_id IS NOT NULL)))
);


ALTER TABLE public.user_access_grants OWNER TO postgres;

--
-- Name: user_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content_id text NOT NULL,
    completed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_progress OWNER TO postgres;

--
-- Name: user_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    question text NOT NULL,
    answer text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    answered_at timestamp with time zone,
    CONSTRAINT user_questions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'answered'::text, 'read'::text])))
);


ALTER TABLE public.user_questions OWNER TO postgres;

--
-- Name: wardrobe_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wardrobe_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    image_url text,
    category text,
    client_note text,
    internal_note text,
    status text DEFAULT 'Keep'::text,
    product_link_id uuid,
    is_general_library boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    notes text,
    brand text,
    tags text[],
    wardrobe_id uuid,
    CONSTRAINT wardrobe_items_status_check CHECK ((status = ANY (ARRAY['Keep'::text, 'Tailor'::text, 'Donate'::text, 'Archive'::text, 'inbox'::text, 'keep'::text, 'tailor'::text, 'donate'::text, 'archive'::text])))
);


ALTER TABLE public.wardrobe_items OWNER TO postgres;

--
-- Name: COLUMN wardrobe_items.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.wardrobe_items.user_id IS 'DEPRECATED: Use wardrobe_id instead. Will be removed in future migration.';


--
-- Name: wardrobes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wardrobes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    title text DEFAULT 'My Wardrobe'::text NOT NULL,
    upload_token uuid DEFAULT gen_random_uuid(),
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT wardrobes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


ALTER TABLE public.wardrobes OWNER TO postgres;

--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    payload jsonb,
    status text,
    error_message text,
    processed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.webhook_events OWNER TO postgres;

--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: boutique_clicks boutique_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_clicks
    ADD CONSTRAINT boutique_clicks_pkey PRIMARY KEY (id);


--
-- Name: boutique_collection_items boutique_collection_items_collection_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_collection_items
    ADD CONSTRAINT boutique_collection_items_collection_id_item_id_key UNIQUE (collection_id, item_id);


--
-- Name: boutique_collection_items boutique_collection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_collection_items
    ADD CONSTRAINT boutique_collection_items_pkey PRIMARY KEY (id);


--
-- Name: boutique_collections boutique_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_collections
    ADD CONSTRAINT boutique_collections_pkey PRIMARY KEY (id);


--
-- Name: boutique_items boutique_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_items
    ADD CONSTRAINT boutique_items_pkey PRIMARY KEY (id);


--
-- Name: boutique_saves boutique_saves_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_saves
    ADD CONSTRAINT boutique_saves_pkey PRIMARY KEY (id);


--
-- Name: boutique_saves boutique_saves_user_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_saves
    ADD CONSTRAINT boutique_saves_user_id_item_id_key UNIQUE (user_id, item_id);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_slug_key UNIQUE (slug);


--
-- Name: essence_responses essence_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.essence_responses
    ADD CONSTRAINT essence_responses_pkey PRIMARY KEY (id);


--
-- Name: lookbook_items lookbook_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lookbook_items
    ADD CONSTRAINT lookbook_items_pkey PRIMARY KEY (lookbook_id, item_id);


--
-- Name: lookbooks lookbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lookbooks
    ADD CONSTRAINT lookbooks_pkey PRIMARY KEY (id);


--
-- Name: masterclasses masterclasses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterclasses
    ADD CONSTRAINT masterclasses_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: offers offers_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_slug_key UNIQUE (slug);


--
-- Name: partner_brands partner_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partner_brands
    ADD CONSTRAINT partner_brands_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: stripe_processed_events stripe_processed_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_processed_events
    ADD CONSTRAINT stripe_processed_events_pkey PRIMARY KEY (event_id);


--
-- Name: tailor_cards tailor_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tailor_cards
    ADD CONSTRAINT tailor_cards_pkey PRIMARY KEY (id);


--
-- Name: tailor_cards tailor_cards_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tailor_cards
    ADD CONSTRAINT tailor_cards_user_id_key UNIQUE (user_id);


--
-- Name: trusted_by_logos trusted_by_logos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trusted_by_logos
    ADD CONSTRAINT trusted_by_logos_pkey PRIMARY KEY (id);


--
-- Name: admin_notifications unique_reference_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT unique_reference_id UNIQUE (reference_id);


--
-- Name: user_access_grants user_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_access_grants
    ADD CONSTRAINT user_access_grants_pkey PRIMARY KEY (id);


--
-- Name: user_progress user_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_pkey PRIMARY KEY (id);


--
-- Name: user_progress user_progress_user_id_content_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_content_id_key UNIQUE (user_id, content_id);


--
-- Name: user_questions user_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_questions
    ADD CONSTRAINT user_questions_pkey PRIMARY KEY (id);


--
-- Name: wardrobe_items wardrobe_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_items
    ADD CONSTRAINT wardrobe_items_pkey PRIMARY KEY (id);


--
-- Name: wardrobes wardrobes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobes
    ADD CONSTRAINT wardrobes_pkey PRIMARY KEY (id);


--
-- Name: wardrobes wardrobes_upload_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobes
    ADD CONSTRAINT wardrobes_upload_token_key UNIQUE (upload_token);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications USING btree (created_at DESC);


--
-- Name: idx_admin_notifications_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_notifications_status ON public.admin_notifications USING btree (status);


--
-- Name: idx_admin_notifications_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_notifications_type ON public.admin_notifications USING btree (type);


--
-- Name: idx_boutique_clicks_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boutique_clicks_item ON public.boutique_clicks USING btree (item_id);


--
-- Name: idx_boutique_clicks_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boutique_clicks_user ON public.boutique_clicks USING btree (user_id);


--
-- Name: idx_boutique_collection_items_collection; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boutique_collection_items_collection ON public.boutique_collection_items USING btree (collection_id);


--
-- Name: idx_boutique_collection_items_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boutique_collection_items_item ON public.boutique_collection_items USING btree (item_id);


--
-- Name: idx_boutique_collections_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boutique_collections_order ON public.boutique_collections USING btree (order_index);


--
-- Name: idx_boutique_saves_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boutique_saves_item ON public.boutique_saves USING btree (item_id);


--
-- Name: idx_boutique_saves_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_boutique_saves_user ON public.boutique_saves USING btree (user_id);


--
-- Name: idx_brands_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_brands_order ON public.partner_brands USING btree (order_index);


--
-- Name: idx_chapters_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chapters_order ON public.chapters USING btree (order_index);


--
-- Name: idx_chapters_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chapters_slug ON public.chapters USING btree (slug);


--
-- Name: idx_essence_responses_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_essence_responses_lookup ON public.essence_responses USING btree (user_id, masterclass_id);


--
-- Name: idx_essence_responses_masterclass; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_essence_responses_masterclass ON public.essence_responses USING btree (masterclass_id);


--
-- Name: idx_essence_responses_uniqueness_v2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_essence_responses_uniqueness_v2 ON public.essence_responses USING btree (user_id, question_key, masterclass_id, chapter_id) NULLS NOT DISTINCT;


--
-- Name: idx_essence_responses_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_essence_responses_user ON public.essence_responses USING btree (user_id);


--
-- Name: idx_items_brand; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_brand ON public.boutique_items USING btree (brand_id);


--
-- Name: idx_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_order ON public.boutique_items USING btree (order_index);


--
-- Name: idx_profiles_intake_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_intake_token ON public.profiles USING btree (intake_token);


--
-- Name: idx_profiles_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_status ON public.profiles USING btree (status);


--
-- Name: idx_purchases_user_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_purchases_user_product ON public.purchases USING btree (user_id, product_id);


--
-- Name: idx_trusted_by_logos_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_trusted_by_logos_order ON public.trusted_by_logos USING btree (order_index);


--
-- Name: idx_user_progress_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_progress_user_id ON public.user_progress USING btree (user_id);


--
-- Name: idx_user_questions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_questions_status ON public.user_questions USING btree (status);


--
-- Name: idx_user_questions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_questions_user_id ON public.user_questions USING btree (user_id);


--
-- Name: idx_wardrobe_items_wardrobe; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobe_items_wardrobe ON public.wardrobe_items USING btree (wardrobe_id);


--
-- Name: idx_wardrobes_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobes_owner ON public.wardrobes USING btree (owner_id);


--
-- Name: idx_wardrobes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobes_status ON public.wardrobes USING btree (status);


--
-- Name: idx_wardrobes_upload_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wardrobes_upload_token ON public.wardrobes USING btree (upload_token);


--
-- Name: tailor_cards ensure_studio_access; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ensure_studio_access BEFORE INSERT ON public.tailor_cards FOR EACH ROW EXECUTE FUNCTION public.check_wardrobe_eligibility();


--
-- Name: lookbooks handle_updated_at_lookbooks; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER handle_updated_at_lookbooks BEFORE UPDATE ON public.lookbooks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: tailor_cards handle_updated_at_tailor_cards; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER handle_updated_at_tailor_cards BEFORE UPDATE ON public.tailor_cards FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: wardrobe_items handle_updated_at_wardrobe_items; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER handle_updated_at_wardrobe_items BEFORE UPDATE ON public.wardrobe_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: essence_responses on_essence_response_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_essence_response_update BEFORE UPDATE ON public.essence_responses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: purchases on_purchase_created; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_purchase_created AFTER INSERT ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.handle_new_purchase();


--
-- Name: services on_services_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_services_update BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: admin_notifications admin_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: boutique_clicks boutique_clicks_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_clicks
    ADD CONSTRAINT boutique_clicks_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.boutique_items(id) ON DELETE CASCADE;


--
-- Name: boutique_clicks boutique_clicks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_clicks
    ADD CONSTRAINT boutique_clicks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: boutique_collection_items boutique_collection_items_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_collection_items
    ADD CONSTRAINT boutique_collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.boutique_collections(id) ON DELETE CASCADE;


--
-- Name: boutique_collection_items boutique_collection_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_collection_items
    ADD CONSTRAINT boutique_collection_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.boutique_items(id) ON DELETE CASCADE;


--
-- Name: boutique_items boutique_items_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_items
    ADD CONSTRAINT boutique_items_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.partner_brands(id) ON DELETE CASCADE;


--
-- Name: boutique_saves boutique_saves_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_saves
    ADD CONSTRAINT boutique_saves_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.boutique_items(id) ON DELETE CASCADE;


--
-- Name: boutique_saves boutique_saves_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boutique_saves
    ADD CONSTRAINT boutique_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chapters chapters_masterclass_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_masterclass_id_fkey FOREIGN KEY (masterclass_id) REFERENCES public.masterclasses(id) ON DELETE CASCADE;


--
-- Name: essence_responses essence_responses_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.essence_responses
    ADD CONSTRAINT essence_responses_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: essence_responses essence_responses_masterclass_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.essence_responses
    ADD CONSTRAINT essence_responses_masterclass_id_fkey FOREIGN KEY (masterclass_id) REFERENCES public.masterclasses(id) ON DELETE CASCADE;


--
-- Name: essence_responses essence_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.essence_responses
    ADD CONSTRAINT essence_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: lookbook_items lookbook_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lookbook_items
    ADD CONSTRAINT lookbook_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.wardrobe_items(id) ON DELETE CASCADE;


--
-- Name: lookbook_items lookbook_items_lookbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lookbook_items
    ADD CONSTRAINT lookbook_items_lookbook_id_fkey FOREIGN KEY (lookbook_id) REFERENCES public.lookbooks(id) ON DELETE CASCADE;


--
-- Name: lookbooks lookbooks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lookbooks
    ADD CONSTRAINT lookbooks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: lookbooks lookbooks_wardrobe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lookbooks
    ADD CONSTRAINT lookbooks_wardrobe_id_fkey FOREIGN KEY (wardrobe_id) REFERENCES public.wardrobes(id) ON DELETE CASCADE;


--
-- Name: purchases purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tailor_cards tailor_cards_last_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tailor_cards
    ADD CONSTRAINT tailor_cards_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id);


--
-- Name: tailor_cards tailor_cards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tailor_cards
    ADD CONSTRAINT tailor_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_access_grants user_access_grants_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_access_grants
    ADD CONSTRAINT user_access_grants_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: user_access_grants user_access_grants_masterclass_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_access_grants
    ADD CONSTRAINT user_access_grants_masterclass_id_fkey FOREIGN KEY (masterclass_id) REFERENCES public.masterclasses(id) ON DELETE CASCADE;


--
-- Name: user_access_grants user_access_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_access_grants
    ADD CONSTRAINT user_access_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_progress user_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: user_questions user_questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_questions
    ADD CONSTRAINT user_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: wardrobe_items wardrobe_items_product_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_items
    ADD CONSTRAINT wardrobe_items_product_link_id_fkey FOREIGN KEY (product_link_id) REFERENCES public.boutique_items(id) ON DELETE SET NULL;


--
-- Name: wardrobe_items wardrobe_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_items
    ADD CONSTRAINT wardrobe_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: wardrobe_items wardrobe_items_wardrobe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobe_items
    ADD CONSTRAINT wardrobe_items_wardrobe_id_fkey FOREIGN KEY (wardrobe_id) REFERENCES public.wardrobes(id) ON DELETE CASCADE;


--
-- Name: wardrobes wardrobes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wardrobes
    ADD CONSTRAINT wardrobes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: admin_notifications Admin full access to notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin full access to notifications" ON public.admin_notifications USING (((auth.uid() IS NOT NULL) AND (auth.uid() = '4613bce4-5a40-4779-9e87-0def946be940'::uuid))) WITH CHECK (((auth.uid() IS NOT NULL) AND (auth.uid() = '4613bce4-5a40-4779-9e87-0def946be940'::uuid)));


--
-- Name: wardrobes Admin full access to wardrobes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin full access to wardrobes" ON public.wardrobes USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: profiles Admins can delete any profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text))))));


--
-- Name: profiles Admins can insert any profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert any profile" ON public.profiles FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text)))));


--
-- Name: chapters Admins can insert chapters; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert chapters" ON public.chapters FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: masterclasses Admins can insert masterclasses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert masterclasses" ON public.masterclasses FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: services Admins can insert services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert services" ON public.services FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: lookbook_items Admins can manage all lookbook items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all lookbook items" ON public.lookbook_items USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: lookbooks Admins can manage all lookbooks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all lookbooks" ON public.lookbooks USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: user_questions Admins can manage all questions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all questions" ON public.user_questions USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: tailor_cards Admins can manage all tailor cards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all tailor cards" ON public.tailor_cards USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: wardrobe_items Admins can manage all wardrobe items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all wardrobe items" ON public.wardrobe_items USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: chapters Admins can manage chapters; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage chapters" ON public.chapters USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: user_access_grants Admins can manage grants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage grants" ON public.user_access_grants USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: masterclasses Admins can manage masterclasses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage masterclasses" ON public.masterclasses USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: offers Admins can manage offers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage offers" ON public.offers USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: services Admins can manage services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage services" ON public.services USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text))))));


--
-- Name: essence_responses Admins can view all essence responses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all essence responses" ON public.essence_responses FOR SELECT USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (((auth.uid() IS NOT NULL) AND (public.get_user_role(auth.uid()) = 'admin'::text)));


--
-- Name: purchases Admins can view all purchases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all purchases" ON public.purchases FOR SELECT USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: partner_brands Admins manage brands; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage brands" ON public.partner_brands USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: boutique_items Admins manage items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage items" ON public.boutique_items USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: chapters Anyone can view chapters; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view chapters" ON public.chapters FOR SELECT USING (true);


--
-- Name: masterclasses Anyone can view masterclasses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view masterclasses" ON public.masterclasses FOR SELECT USING (true);


--
-- Name: offers Public read active offers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read active offers" ON public.offers FOR SELECT USING ((active = true));


--
-- Name: services Public read services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);


--
-- Name: partner_brands Public view brands; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public view brands" ON public.partner_brands FOR SELECT USING ((active = true));


--
-- Name: boutique_items Public view items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public view items" ON public.boutique_items FOR SELECT USING ((active = true));


--
-- Name: webhook_events Service Role Full Access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service Role Full Access" ON public.webhook_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: profiles Service role can insert profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can insert profile" ON public.profiles FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: essence_responses Users can insert own essence responses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own essence responses" ON public.essence_responses FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (id = auth.uid())));


--
-- Name: user_progress Users can insert own progress; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own progress" ON public.user_progress FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: user_questions Users can insert own questions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own questions" ON public.user_questions FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: wardrobe_items Users can insert own wardrobe items during intake; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own wardrobe items during intake" ON public.wardrobe_items FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: essence_responses Users can update own essence responses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own essence responses" ON public.essence_responses FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()))) WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (id = auth.uid()))) WITH CHECK (((auth.uid() IS NOT NULL) AND (id = auth.uid())));


--
-- Name: user_progress Users can update own progress.; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own progress." ON public.user_progress FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: lookbook_items Users can view items in their lookbooks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view items in their lookbooks" ON public.lookbook_items FOR SELECT USING (((auth.uid() IS NOT NULL) AND (lookbook_id IN ( SELECT lookbooks.id
   FROM public.lookbooks
  WHERE ((lookbooks.user_id = auth.uid()) OR (lookbooks.wardrobe_id IN ( SELECT wardrobes.id
           FROM public.wardrobes
          WHERE (wardrobes.owner_id = auth.uid()))))))));


--
-- Name: essence_responses Users can view own essence responses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own essence responses" ON public.essence_responses FOR SELECT USING (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: user_progress Users can view own progress; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own progress" ON public.user_progress FOR SELECT USING (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: user_questions Users can view own questions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own questions" ON public.user_questions FOR SELECT USING (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: tailor_cards Users can view own tailor card; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own tailor card" ON public.tailor_cards FOR SELECT USING (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: wardrobe_items Users can view own wardrobe items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own wardrobe items" ON public.wardrobe_items FOR SELECT USING (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (wardrobe_id IN ( SELECT wardrobes.id
   FROM public.wardrobes
  WHERE (wardrobes.owner_id = auth.uid()))))));


--
-- Name: wardrobes Users can view own wardrobes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own wardrobes" ON public.wardrobes FOR SELECT USING (((auth.uid() IS NOT NULL) AND (owner_id = auth.uid())));


--
-- Name: user_access_grants Users can view their own grants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own grants" ON public.user_access_grants FOR SELECT USING (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (((auth.uid() IS NOT NULL) AND (id = auth.uid())));


--
-- Name: purchases Users can view their own purchases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own purchases" ON public.purchases FOR SELECT USING (((auth.uid() IS NOT NULL) AND (user_id = auth.uid())));


--
-- Name: lookbooks Users can view their published lookbooks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their published lookbooks" ON public.lookbooks FOR SELECT USING (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (wardrobe_id IN ( SELECT wardrobes.id
   FROM public.wardrobes
  WHERE (wardrobes.owner_id = auth.uid())))) AND (status = 'Published'::text)));


--
-- Name: admin_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: boutique_clicks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.boutique_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: boutique_clicks boutique_clicks: admin read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_clicks: admin read" ON public.boutique_clicks FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: boutique_clicks boutique_clicks: anon insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_clicks: anon insert" ON public.boutique_clicks FOR INSERT WITH CHECK ((user_id IS NULL));


--
-- Name: boutique_clicks boutique_clicks: authenticated insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_clicks: authenticated insert" ON public.boutique_clicks FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: boutique_collection_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.boutique_collection_items ENABLE ROW LEVEL SECURITY;

--
-- Name: boutique_collection_items boutique_collection_items: admin write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_collection_items: admin write" ON public.boutique_collection_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: boutique_collection_items boutique_collection_items: authenticated read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_collection_items: authenticated read" ON public.boutique_collection_items FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: boutique_collections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.boutique_collections ENABLE ROW LEVEL SECURITY;

--
-- Name: boutique_collections boutique_collections: admin write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_collections: admin write" ON public.boutique_collections USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: boutique_collections boutique_collections: authenticated read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_collections: authenticated read" ON public.boutique_collections FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: boutique_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.boutique_items ENABLE ROW LEVEL SECURITY;

--
-- Name: boutique_saves; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.boutique_saves ENABLE ROW LEVEL SECURITY;

--
-- Name: boutique_saves boutique_saves: user delete own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_saves: user delete own" ON public.boutique_saves FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: boutique_saves boutique_saves: user insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_saves: user insert own" ON public.boutique_saves FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: boutique_saves boutique_saves: user read own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "boutique_saves: user read own" ON public.boutique_saves FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chapters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

--
-- Name: essence_responses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.essence_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: lookbook_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lookbook_items ENABLE ROW LEVEL SECURITY;

--
-- Name: lookbooks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lookbooks ENABLE ROW LEVEL SECURITY;

--
-- Name: masterclasses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.masterclasses ENABLE ROW LEVEL SECURITY;

--
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_brands; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partner_brands ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: purchases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_processed_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

--
-- Name: tailor_cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tailor_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: trusted_by_logos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.trusted_by_logos ENABLE ROW LEVEL SECURITY;

--
-- Name: trusted_by_logos trusted_by_logos: admin write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "trusted_by_logos: admin write" ON public.trusted_by_logos USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: trusted_by_logos trusted_by_logos: public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "trusted_by_logos: public read" ON public.trusted_by_logos FOR SELECT USING (true);


--
-- Name: user_access_grants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_access_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: user_progress; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: user_questions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: wardrobe_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;

--
-- Name: wardrobes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wardrobes ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION check_access(check_user_id uuid, check_object_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_access(check_user_id uuid, check_object_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_access(check_user_id uuid, check_object_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_access(check_user_id uuid, check_object_id uuid) TO service_role;


--
-- Name: FUNCTION check_rate_limit(p_key text, p_max integer, p_window interval); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window interval) TO anon;
GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window interval) TO authenticated;
GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window interval) TO service_role;


--
-- Name: FUNCTION check_wardrobe_eligibility(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_wardrobe_eligibility() TO anon;
GRANT ALL ON FUNCTION public.check_wardrobe_eligibility() TO authenticated;
GRANT ALL ON FUNCTION public.check_wardrobe_eligibility() TO service_role;


--
-- Name: FUNCTION clone_lookbook(lookbook_id uuid, target_profile_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.clone_lookbook(lookbook_id uuid, target_profile_id uuid) TO anon;
GRANT ALL ON FUNCTION public.clone_lookbook(lookbook_id uuid, target_profile_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.clone_lookbook(lookbook_id uuid, target_profile_id uuid) TO service_role;


--
-- Name: FUNCTION clone_wardrobe_item(item_id uuid, target_profile_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.clone_wardrobe_item(item_id uuid, target_profile_id uuid) TO anon;
GRANT ALL ON FUNCTION public.clone_wardrobe_item(item_id uuid, target_profile_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.clone_wardrobe_item(item_id uuid, target_profile_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_role(user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_role(user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_role(user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_role(user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_purchase(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_purchase() TO anon;
GRANT ALL ON FUNCTION public.handle_new_purchase() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_purchase() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_updated_at() TO anon;
GRANT ALL ON FUNCTION public.handle_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.handle_updated_at() TO service_role;


--
-- Name: TABLE admin_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_notifications TO anon;
GRANT ALL ON TABLE public.admin_notifications TO authenticated;
GRANT ALL ON TABLE public.admin_notifications TO service_role;


--
-- Name: TABLE boutique_clicks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.boutique_clicks TO anon;
GRANT ALL ON TABLE public.boutique_clicks TO authenticated;
GRANT ALL ON TABLE public.boutique_clicks TO service_role;


--
-- Name: TABLE boutique_collection_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.boutique_collection_items TO anon;
GRANT ALL ON TABLE public.boutique_collection_items TO authenticated;
GRANT ALL ON TABLE public.boutique_collection_items TO service_role;


--
-- Name: TABLE boutique_collections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.boutique_collections TO anon;
GRANT ALL ON TABLE public.boutique_collections TO authenticated;
GRANT ALL ON TABLE public.boutique_collections TO service_role;


--
-- Name: TABLE boutique_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.boutique_items TO anon;
GRANT ALL ON TABLE public.boutique_items TO authenticated;
GRANT ALL ON TABLE public.boutique_items TO service_role;


--
-- Name: TABLE boutique_saves; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.boutique_saves TO anon;
GRANT ALL ON TABLE public.boutique_saves TO authenticated;
GRANT ALL ON TABLE public.boutique_saves TO service_role;


--
-- Name: TABLE chapters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chapters TO anon;
GRANT ALL ON TABLE public.chapters TO authenticated;
GRANT ALL ON TABLE public.chapters TO service_role;


--
-- Name: TABLE essence_responses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.essence_responses TO anon;
GRANT ALL ON TABLE public.essence_responses TO authenticated;
GRANT ALL ON TABLE public.essence_responses TO service_role;


--
-- Name: TABLE lookbook_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lookbook_items TO anon;
GRANT ALL ON TABLE public.lookbook_items TO authenticated;
GRANT ALL ON TABLE public.lookbook_items TO service_role;


--
-- Name: TABLE lookbooks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lookbooks TO anon;
GRANT ALL ON TABLE public.lookbooks TO authenticated;
GRANT ALL ON TABLE public.lookbooks TO service_role;


--
-- Name: TABLE masterclasses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.masterclasses TO anon;
GRANT ALL ON TABLE public.masterclasses TO authenticated;
GRANT ALL ON TABLE public.masterclasses TO service_role;


--
-- Name: TABLE offers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.offers TO anon;
GRANT ALL ON TABLE public.offers TO authenticated;
GRANT ALL ON TABLE public.offers TO service_role;


--
-- Name: TABLE partner_brands; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.partner_brands TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.partner_brands TO authenticated;
GRANT ALL ON TABLE public.partner_brands TO service_role;


--
-- Name: COLUMN partner_brands.id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(id) ON TABLE public.partner_brands TO anon;
GRANT SELECT(id) ON TABLE public.partner_brands TO authenticated;


--
-- Name: COLUMN partner_brands.name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(name) ON TABLE public.partner_brands TO anon;
GRANT SELECT(name) ON TABLE public.partner_brands TO authenticated;


--
-- Name: COLUMN partner_brands.logo_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(logo_url) ON TABLE public.partner_brands TO anon;
GRANT SELECT(logo_url) ON TABLE public.partner_brands TO authenticated;


--
-- Name: COLUMN partner_brands.website_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(website_url) ON TABLE public.partner_brands TO anon;
GRANT SELECT(website_url) ON TABLE public.partner_brands TO authenticated;


--
-- Name: COLUMN partner_brands.order_index; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(order_index) ON TABLE public.partner_brands TO anon;
GRANT SELECT(order_index) ON TABLE public.partner_brands TO authenticated;


--
-- Name: COLUMN partner_brands.active; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(active) ON TABLE public.partner_brands TO anon;
GRANT SELECT(active) ON TABLE public.partner_brands TO authenticated;


--
-- Name: COLUMN partner_brands.partnership_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(partnership_status) ON TABLE public.partner_brands TO anon;
GRANT SELECT(partnership_status) ON TABLE public.partner_brands TO authenticated;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE purchases; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchases TO anon;
GRANT ALL ON TABLE public.purchases TO authenticated;
GRANT ALL ON TABLE public.purchases TO service_role;


--
-- Name: TABLE rate_limits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rate_limits TO anon;
GRANT ALL ON TABLE public.rate_limits TO authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;


--
-- Name: TABLE services; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.services TO anon;
GRANT ALL ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;


--
-- Name: TABLE stripe_processed_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stripe_processed_events TO anon;
GRANT ALL ON TABLE public.stripe_processed_events TO authenticated;
GRANT ALL ON TABLE public.stripe_processed_events TO service_role;


--
-- Name: TABLE tailor_cards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tailor_cards TO anon;
GRANT ALL ON TABLE public.tailor_cards TO authenticated;
GRANT ALL ON TABLE public.tailor_cards TO service_role;


--
-- Name: TABLE trusted_by_logos; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.trusted_by_logos TO anon;
GRANT ALL ON TABLE public.trusted_by_logos TO authenticated;
GRANT ALL ON TABLE public.trusted_by_logos TO service_role;


--
-- Name: TABLE user_access_grants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_access_grants TO anon;
GRANT ALL ON TABLE public.user_access_grants TO authenticated;
GRANT ALL ON TABLE public.user_access_grants TO service_role;


--
-- Name: TABLE user_progress; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_progress TO anon;
GRANT ALL ON TABLE public.user_progress TO authenticated;
GRANT ALL ON TABLE public.user_progress TO service_role;


--
-- Name: TABLE user_questions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_questions TO anon;
GRANT ALL ON TABLE public.user_questions TO authenticated;
GRANT ALL ON TABLE public.user_questions TO service_role;


--
-- Name: TABLE wardrobe_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wardrobe_items TO anon;
GRANT ALL ON TABLE public.wardrobe_items TO authenticated;
GRANT ALL ON TABLE public.wardrobe_items TO service_role;


--
-- Name: TABLE wardrobes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wardrobes TO anon;
GRANT ALL ON TABLE public.wardrobes TO authenticated;
GRANT ALL ON TABLE public.wardrobes TO service_role;


--
-- Name: TABLE webhook_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.webhook_events TO anon;
GRANT ALL ON TABLE public.webhook_events TO authenticated;
GRANT ALL ON TABLE public.webhook_events TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict SZT0He1O431zs4IaoM6gfRiGxmE4hhFRUiBGBIKPAF4aIYZRkfQ12wOgroFuRgk

