import { cache } from 'react';

/**
 * Resolve the current viewer (auth user + profile row) once per request.
 *
 * React's `cache()` dedupes across the render pass, so the Vault layout and the
 * page share a single `auth.getUser()` round-trip and a single `profiles` query.
 * Previously each called both independently (the layout for `role`, the page for
 * `full_name`/`is_guest`), costing an extra auth round-trip and query per load.
 *
 * Returns raw data on purpose: "guest" means two different things to callers —
 * the layout means an anonymous auth user (`user.is_anonymous`), the dashboard
 * means a guest-invite profile (`profiles.is_guest`). Each derives its own.
 */
export const getViewer = cache(async () => {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { user: null, profile: null };

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, is_guest, role, active_studio_client')
        .eq('id', user.id)
        .single();

    return { user, profile };
});
