/**
 * Row types for the tables the studio/admin/vault UI reads, derived from the
 * GENERATED schema types (lib/database.types.ts, `npm run db:types`), not
 * written by hand. They were handwritten until 2026-09-28 (ARCH-001), and had
 * drifted: nullable columns typed as non-null, jsonb typed as whatever shape a
 * reader hoped for, and a column (services.price_display_es) that never
 * existed. The generated rows are the truth; what is added here is only what
 * a query adds (joins, computed counts) or deliberately leaves out.
 *
 * jsonb columns stay `Json`: the database promises nothing about their shape,
 * so readers parse them (app/lib/json.ts) instead of casting.
 */
import type { Tables } from '@/lib/database.types';

export type { Json } from '@/lib/database.types';

export type Profile = Tables<'profiles'>;

export type Wardrobe = Tables<'wardrobes'> & {
    profiles?: Partial<Pick<Profile, 'full_name' | 'email' | 'avatar_url'>> | null;
    item_count?: number;
};

export type WardrobeItem = Omit<Tables<'wardrobe_items'>, 'internal_note'> & {
    /**
     * The stylist's private note. Optional because it is genuinely absent from
     * client-side reads: migration 08 revokes column access from
     * `authenticated`, so browser queries name CLIENT_ITEM_COLUMNS and this
     * field only arrives via getAdminWardrobeItems (service role).
     */
    internal_note?: string | null;
    profiles?: Pick<Profile, 'full_name'> | null;
};

export type Lookbook = Tables<'lookbooks'>;

/** Paid content (lab_questions, resource_urls) is absent on browser reads since migration 30. */
export type Chapter = Omit<Tables<'chapters'>, 'lab_questions' | 'resource_urls'> & {
    lab_questions?: Tables<'chapters'>['lab_questions'];
    resource_urls?: Tables<'chapters'>['resource_urls'];
    // Supabase join alias (masterclass:masterclasses(title)); may be object or array.
    masterclasses?: { title: string } | { title: string }[] | null;
};

/** Paid content (resource_urls) is absent on browser reads since migration 30. */
export type Masterclass = Omit<Tables<'masterclasses'>, 'resource_urls'> & {
    resource_urls?: Tables<'masterclasses'>['resource_urls'];
};

/**
 * One downloadable as a member sees it: a name and a link she can open. For a
 * file in the private vault-resources bucket the link is a short-lived signed
 * URL minted after the access check (app/lib/paid-content.ts).
 */
export interface VaultResource {
    name: string;
    url: string;
}

/**
 * One downloadable as stored in a `resource_urls` column: either an external
 * link (`url`), or an object in the private vault-resources bucket (`path`).
 * Legacy rows carry a public vault-assets `url`.
 */
export interface StoredVaultResource {
    name: string;
    url?: string;
    path?: string;
}

export type Service = Tables<'services'>;

export type BoutiqueItem = Tables<'boutique_items'> & {
    // Supabase join alias (brand:partner_brands(name)).
    brand?: { name: string } | null;
};

export type PartnerBrand = Tables<'partner_brands'>;

export type BoutiqueCollection = Tables<'boutique_collections'> & {
    items?: Array<{ item_id: string; [key: string]: unknown }>;
};

export type TrustedLogo = Tables<'trusted_by_logos'>;

export type Offer = Tables<'offers'>;

export type UserQuestion = Tables<'user_questions'>;

export type EssenceResponse = Tables<'essence_responses'>;
