import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Result of an authorization guard.
 *
 * On success, `supabase` is the cookie-aware, RLS-respecting server client for
 * the caller — reuse it for reads/writes that should honour RLS. Service-role
 * work still builds its own admin client separately; the guard only proves who
 * the caller is.
 */
export type GuardResult =
    | { ok: true; user: User; supabase: SupabaseClient }
    | { ok: false; error: string };

/**
 * Require an authenticated caller. Use at the top of any server action that
 * must not run for anonymous requests. Returns `{ ok: false, error }` rather
 * than throwing, to match the `{ success, error }` convention used across the
 * action layer.
 */
export async function requireUser(): Promise<GuardResult> {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { ok: false, error: 'Unauthorized' };
    return { ok: true, user, supabase };
}

/**
 * Require an authenticated caller whose profile has `role === 'admin'`.
 * The role is read through the RLS-respecting client (a user can only read
 * their own profile row), so this cannot be spoofed by the caller.
 */
export async function requireAdmin(): Promise<GuardResult> {
    const auth = await requireUser();
    if (!auth.ok) return auth;

    const { data: profile } = await auth.supabase
        .from('profiles')
        .select('role')
        .eq('id', auth.user.id)
        .single();

    if (profile?.role !== 'admin') return { ok: false, error: 'Forbidden' };
    return auth;
}
