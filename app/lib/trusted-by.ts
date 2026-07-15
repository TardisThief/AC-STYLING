import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { TrustedLogo } from '@/app/lib/types';

/**
 * Public read of the partner logos on the landing page.
 *
 * This deliberately does NOT use `utils/supabase/server`. That client reads
 * `cookies()`, and a single cookie access opts the whole route out of static
 * rendering — which is why the landing page (and, through the shared layout,
 * every marketing and legal page) was server-rendered on every request just to
 * fetch a list of logos that changes a few times a year.
 *
 * The logos are public data with no per-user variation, so an anon-key client
 * with no session is the honest client for the job. The result is cached and
 * tagged; admin writes call `revalidateTag(TRUSTED_BY_TAG)`, so edits still
 * appear immediately rather than waiting out the TTL.
 */

export const TRUSTED_BY_TAG = 'trusted-by-logos';

export const getPublicTrustedByLogos = unstable_cache(
    async (): Promise<TrustedLogo[]> => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data, error } = await supabase
            .from('trusted_by_logos')
            .select('*')
            .eq('active', true)
            .order('order_index', { ascending: true });

        // Returning [] lets the caller fall back to the bundled partner images
        // rather than failing the page over a decorative strip.
        if (error) return [];
        return data ?? [];
    },
    ['trusted-by-logos'],
    {
        tags: [TRUSTED_BY_TAG],
        // Backstop only. Correctness comes from the tag; this just bounds how
        // stale things can get if a revalidate is ever missed.
        revalidate: 3600,
    }
);
