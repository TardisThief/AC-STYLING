import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

/**
 * Public catalogue read for the Vault sales page.
 *
 * Like `app/lib/trusted-by.ts`, this deliberately avoids
 * `utils/supabase/server`: that client reads `cookies()`, and a single cookie
 * access opts the whole route out of static rendering. The catalogue is public
 * data with no per-user variation, so an anon-key client with no session is the
 * honest client for the job. RLS already allows anonymous SELECT on both tables
 * ("Anyone can view masterclasses" / "Anyone can view chapters").
 *
 * The column lists here are explicit and never include `video_id` or
 * `video_id_es`. Those are entitlement-gated by migration 09; selecting them
 * from an anon client will start erroring the moment it is applied, and a
 * marketing page has no business reading them regardless.
 */

export { VAULT_CATALOG_TAG } from '@/app/lib/cache-tags';
import { VAULT_CATALOG_TAG } from '@/app/lib/cache-tags';
import { isEnabled } from '@/app/lib/env-flags';

/** Columns safe to read anonymously. Mirrors migration 09's grant list. */
const COURSE_COLUMNS =
    'id, title, title_es, subtitle, subtitle_es, description, description_es, ' +
    'thumbnail_url, order_index, price_display, runtime_minutes, is_published, ' +
    'available_at, stripe_product_id, price_id';

const MODULE_COLUMNS =
    'id, slug, title, title_es, subtitle, subtitle_es, description, description_es, ' +
    'order_index, takeaways, takeaways_es, category, masterclass_id, is_standalone, ' +
    'is_published, available_at, thumbnail_url, stripe_product_id, price_id';

export interface CatalogModule {
    id: string;
    slug: string;
    title: string;
    title_es: string | null;
    subtitle: string | null;
    subtitle_es: string | null;
    description: string | null;
    description_es: string | null;
    order_index: number;
    takeaways: unknown;
    takeaways_es: unknown;
    is_published: boolean;
    available_at: string | null;
}

export interface CatalogEntry {
    /** A masterclass has modules; a standalone course is its own single unit. */
    kind: 'masterclass' | 'course';
    id: string;
    title: string;
    title_es: string | null;
    subtitle: string | null;
    subtitle_es: string | null;
    description: string | null;
    description_es: string | null;
    thumbnail_url: string | null;
    order_index: number;
    price_display: string | null;
    runtime_minutes: number | null;
    is_published: boolean;
    available_at: string | null;
    price_id: string | null;
    /** Empty for a standalone course. */
    modules: CatalogModule[];
}

type RawCourse = Record<string, unknown>;

function toModule(row: RawCourse): CatalogModule {
    return {
        id: row.id as string,
        slug: row.slug as string,
        title: row.title as string,
        title_es: (row.title_es as string) ?? null,
        subtitle: (row.subtitle as string) ?? null,
        subtitle_es: (row.subtitle_es as string) ?? null,
        description: (row.description as string) ?? null,
        description_es: (row.description_es as string) ?? null,
        order_index: (row.order_index as number) ?? 0,
        takeaways: row.takeaways ?? [],
        takeaways_es: row.takeaways_es ?? [],
        is_published: Boolean(row.is_published),
        available_at: (row.available_at as string) ?? null,
    };
}

/**
 * Everything the catalogue can show, published or not. Filtering by
 * `is_published` is the caller's job, because the page renders unpublished
 * entries as "in production" cards when the reveal flag is on.
 */
export const getVaultCatalog = unstable_cache(
    async (): Promise<CatalogEntry[]> => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const [coursesRes, modulesRes] = await Promise.all([
            supabase.from('masterclasses').select(COURSE_COLUMNS).order('order_index', { ascending: true }),
            supabase.from('chapters').select(MODULE_COLUMNS).order('order_index', { ascending: true }),
        ]);

        // A catalogue that cannot be read should render as empty rather than
        // crash the page; the section has a real empty state.
        if (coursesRes.error || modulesRes.error) return [];

        const allModules = (modulesRes.data ?? []) as unknown as RawCourse[];

        const masterclasses: CatalogEntry[] = ((coursesRes.data ?? []) as unknown as RawCourse[]).map((m) => ({
            kind: 'masterclass',
            id: m.id as string,
            title: m.title as string,
            title_es: (m.title_es as string) ?? null,
            subtitle: (m.subtitle as string) ?? null,
            subtitle_es: (m.subtitle_es as string) ?? null,
            description: (m.description as string) ?? null,
            description_es: (m.description_es as string) ?? null,
            thumbnail_url: (m.thumbnail_url as string) ?? null,
            order_index: (m.order_index as number) ?? 0,
            price_display: (m.price_display as string) ?? null,
            runtime_minutes: (m.runtime_minutes as number) ?? null,
            is_published: Boolean(m.is_published),
            available_at: (m.available_at as string) ?? null,
            price_id: (m.price_id as string) ?? null,
            modules: allModules
                .filter((c) => c.masterclass_id === m.id)
                .map(toModule)
                .sort((a, b) => a.order_index - b.order_index),
        }));

        // Standalone courses: a chapter with no parent masterclass.
        const standalone: CatalogEntry[] = allModules
            .filter((c) => !c.masterclass_id && c.category === 'course')
            .map((c) => ({
                kind: 'course',
                id: c.id as string,
                title: c.title as string,
                title_es: (c.title_es as string) ?? null,
                subtitle: (c.subtitle as string) ?? null,
                subtitle_es: (c.subtitle_es as string) ?? null,
                description: (c.description as string) ?? null,
                description_es: (c.description_es as string) ?? null,
                thumbnail_url: (c.thumbnail_url as string) ?? null,
                order_index: (c.order_index as number) ?? 0,
                price_display: null,
                runtime_minutes: null,
                is_published: Boolean(c.is_published),
                available_at: (c.available_at as string) ?? null,
                price_id: (c.price_id as string) ?? null,
                modules: [],
            }));

        return [...masterclasses, ...standalone].sort((a, b) => a.order_index - b.order_index);
    },
    ['vault-catalog'],
    {
        tags: [VAULT_CATALOG_TAG],
        // Backstop only. Correctness comes from the tag: the admin chapter and
        // masterclass writes call updateTag(VAULT_CATALOG_TAG). They did not
        // until 2026-09-21 — this comment described an intention rather than
        // the code, so an admin edit took up to an hour to reach the sales
        // page. A direct database import still relies on this backstop, or on
        // a redeploy.
        revalidate: 3600,
    }
);

/**
 * Whether courses still in production are shown as "in production" cards.
 *
 * Deploy-time, not per-request: the page is statically prerendered, so this is
 * baked at build. Off unless explicitly enabled.
 */
export function shouldRevealUpcoming(): boolean {
    return isEnabled(process.env.VAULT_REVEAL_UPCOMING);
}

/** Pick the Spanish field when the locale is `es` and the value is non-empty. */
export function pickLocale(
    locale: string,
    base: string | null,
    translated: string | null
): string | null {
    if (locale === 'es' && translated && translated.trim().length > 0) return translated;
    return base;
}

export interface VaultOffer {
    slug: string;
    title: string;
    title_es: string | null;
    description: string | null;
    description_es: string | null;
    price_display: string | null;
    price_id: string | null;
}

/**
 * The active offers the sales page can sell. Same cookieless, cached read as
 * the catalogue; RLS exposes only `active = true` rows to anon.
 *
 * Keyed by slug so callers ask for `full_access` by name rather than guessing
 * at an array position.
 */
export const getVaultOffers = unstable_cache(
    async (): Promise<Record<string, VaultOffer>> => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data, error } = await supabase
            .from('offers')
            .select('slug, title, title_es, description, description_es, price_display, price_id')
            .eq('active', true);

        if (error || !data) return {};

        return Object.fromEntries(
            (data as unknown as VaultOffer[]).map((o) => [o.slug, o])
        );
    },
    ['vault-offers'],
    { tags: [VAULT_CATALOG_TAG], revalidate: 3600 }
);

export type HeadlinePass = 'full_access' | 'masterclass_pass';

/**
 * The pass the sales page leads with. Full Access when it is on sale (it
 * includes everything the Masterclass Pass does), else the Masterclass Pass.
 * With neither active this still answers `full_access`, so the page keeps its
 * copy and the button falls back to "Available soon".
 */
export function pickHeadlinePass(offers: Record<string, VaultOffer>): HeadlinePass {
    if (offers['full_access']) return 'full_access';
    if (offers['masterclass_pass']) return 'masterclass_pass';
    return 'full_access';
}
