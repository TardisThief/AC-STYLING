import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Does this member already hold what this Stripe price sells, right now?
 *
 * Found in the 2026-09-28 paid-path rehearsal: the sales page is prerendered
 * and cannot know what a signed-in visitor owns, so it offered a pass holder
 * the pass again, and nothing downstream refuses a second payment (the
 * webhook grants it and extends the term; sales are final). Checkout asks
 * this before it opens Stripe (tests/integration/already-owned.test.ts).
 *
 * The rule is what the Vault unlocks, so it goes through `check_access` for
 * content and reads the pass flags with the same live-term rule: a lapsed
 * member may buy again, a single-masterclass buyer may move up to the pass,
 * and a service is never "owned". Admins are never refused — `check_access`
 * says yes to them for everything, and the owner must be able to run a test
 * purchase from her own account.
 *
 * Read with the service role (`check_access` answers for any user to it).
 * Fails open: a read that errors lets the checkout go ahead, because refusing
 * a sale on a database hiccup is worse than the rare double purchase this
 * exists to prevent.
 */
export async function alreadyHolds(admin: SupabaseClient, userId: string, priceId: string): Promise<boolean> {
    try {
        const { data: profile } = await admin
            .from('profiles')
            .select('role, has_full_unlock, has_course_pass, has_masterclass_pass, access_expires_at')
            .eq('id', userId)
            .maybeSingle();
        if (!profile || profile.role === 'admin') return false;

        // A null expiry is perpetual access, sold before the term existed.
        const termLive = !profile.access_expires_at || new Date(profile.access_expires_at).getTime() > Date.now();

        const { data: offer } = await admin.from('offers').select('slug').eq('price_id', priceId).maybeSingle();
        if (offer) {
            if (!termLive) return false;
            if (profile.has_full_unlock) return true;
            if (offer.slug === 'masterclass_pass') return !!profile.has_masterclass_pass;
            if (offer.slug === 'course_pass') return !!profile.has_course_pass;
            return false;
        }

        const { data: masterclass } = await admin.from('masterclasses').select('id').eq('price_id', priceId).maybeSingle();
        const { data: chapter } = masterclass
            ? { data: null }
            : await admin.from('chapters').select('id').eq('price_id', priceId).maybeSingle();
        const objectId = (masterclass?.id ?? chapter?.id) as string | undefined;
        if (!objectId) return false; // A service, or nothing we sell as content.

        const { data: hasAccess, error } = await admin.rpc('check_access', {
            check_user_id: userId,
            check_object_id: objectId,
        });
        if (error) {
            console.error('[already-owned] check_access failed:', error.message);
            return false;
        }
        return hasAccess === true;
    } catch (err) {
        console.error('[already-owned] lookup failed:', err);
        return false;
    }
}
