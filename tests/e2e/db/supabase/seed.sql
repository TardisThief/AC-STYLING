-- Fixtures for the browser tests (tests/e2e), loaded by `supabase start` into
-- the LOCAL test database only, after the baseline and supabase/platform.sql.
-- Nothing here is real data. The ids and passwords are published on purpose;
-- they are only accepted by a database on localhost that exists for a test run.
--
-- tests/e2e/fixtures.ts names the same accounts; keep the two in step.

-- Two accounts: a member and an admin. Inserted as GoTrue would, so a
-- password sign-in works, and so the on_auth_user_created trigger (from
-- platform.sql) creates their profiles, which also proves that file applies.
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
    ('00000000-0000-0000-0000-000000000000', 'e2e00000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
     'e2e-member@example.test', extensions.crypt('e2e-member-password', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Test Member"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'e2e00000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
     'e2e-admin@example.test', extensions.crypt('e2e-admin-password', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin"}', now(), now(), '', '', '', ''),
    -- Its own account for the sign-out test: Supabase's sign-out ends every
    -- session of the account, which would sign out tests running in parallel.
    ('00000000-0000-0000-0000-000000000000', 'e2e00000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
     'e2e-signout@example.test', extensions.crypt('e2e-signout-password', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Test Leaver"}', now(), now(), '', '', '', '');

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
FROM auth.users u
WHERE u.email IN ('e2e-member@example.test', 'e2e-admin@example.test', 'e2e-signout@example.test');

-- The trigger made every profile as a plain user. The admin is promoted here;
-- the member holds the Masterclass Pass for a year.
UPDATE public.profiles SET role = 'admin' WHERE id = 'e2e00000-0000-4000-8000-000000000002';
UPDATE public.profiles
SET has_masterclass_pass = true, access_expires_at = now() + interval '365 days'
WHERE id = 'e2e00000-0000-4000-8000-000000000001';

-- A small catalogue: the launch offer, one published masterclass with two
-- modules, and one unpublished one (so "In production" logic has something).
INSERT INTO public.offers (slug, title, title_es, price_display, stripe_product_id, price_id, active)
VALUES ('masterclass_pass', 'Masterclass Pass', 'Pase de masterclasses', '$150', 'prod_e2e_pass', 'price_e2e_pass', true);

INSERT INTO public.masterclasses (id, title, title_es, subtitle, subtitle_es, order_index, is_published, stripe_product_id, price_id, price_display)
VALUES
    ('e2e00000-0000-4000-8000-0000000000a1', 'Colorimetry', 'Colorimetría', 'Find your colours', 'Encuentra tus colores', 1, true,
     'prod_e2e_colorimetry', 'price_e2e_colorimetry', '$60'),
    ('e2e00000-0000-4000-8000-0000000000a2', 'Body Shape', 'Silueta', 'Dress your shape', 'Viste tu silueta', 2, false, NULL, NULL, NULL);

INSERT INTO public.chapters (id, slug, title, video_id, order_index, is_published, masterclass_id, is_standalone)
VALUES
    ('e2e00000-0000-4000-8000-0000000000b1', 'e2e-colour-basics', 'Colour basics', 'pending_video', 1, true, 'e2e00000-0000-4000-8000-0000000000a1', false),
    ('e2e00000-0000-4000-8000-0000000000b2', 'e2e-your-palette', 'Your palette', 'pending_video', 2, true, 'e2e00000-0000-4000-8000-0000000000a1', false);
