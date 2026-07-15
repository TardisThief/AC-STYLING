/**
 * Shared row types for the Supabase tables the studio/admin/vault UI reads.
 * Fields mirror the DB schema (text→string, uuid→string, integer→number,
 * jsonb→unknown, text[]→string[]); nullable columns are `| null`. Optional
 * `?` fields are joins/computed columns some queries add. These replace the
 * `any` that DB-row component state used before generated Supabase types exist.
 */

export interface Profile {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    email: string | null;
    role: string | null;
    language_preference: string | null;
    status: string | null;
    is_guest: boolean | null;
    intake_token: string | null;
    active_studio_client: boolean | null;
    has_full_unlock: boolean | null;
    has_course_pass: boolean | null;
    style_essentials: unknown;
    studio_permissions: unknown;
    created_at: string | null;
    updated_at: string | null;
}

export interface Wardrobe {
    id: string;
    owner_id: string | null;
    title: string;
    upload_token: string | null;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
    profiles?: Pick<Profile, 'full_name' | 'email' | 'avatar_url'> | null;
    item_count?: number;
}

export interface WardrobeItem {
    id: string;
    user_id: string | null;
    wardrobe_id: string | null;
    image_url: string | null;
    category: string | null;
    client_note: string | null;
    /**
     * The stylist's private note. Optional because it is genuinely absent from
     * client-side reads: migration 08 revokes column access from
     * `authenticated`, so browser queries name CLIENT_ITEM_COLUMNS and this
     * field only arrives via getAdminWardrobeItems (service role).
     */
    internal_note?: string | null;
    /** Shared stylist note — the client reads this as "Stylist Note". */
    notes: string | null;
    brand: string | null;
    status: string | null;
    tags: string[] | null;
    product_link_id: string | null;
    is_general_library: boolean | null;
    created_at: string | null;
    updated_at: string | null;
    profiles?: Pick<Profile, 'full_name'> | null;
}

export interface Lookbook {
    id: string;
    user_id: string | null;
    wardrobe_id: string | null;
    title: string;
    collection_name: string | null;
    status: string | null;
    metadata: unknown;
    lookbook_items: unknown;
    thumbnail_url: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface Chapter {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    video_id: string;
    video_id_es: string | null;
    order_index: number;
    category: string | null;
    thumbnail_url: string | null;
    lab_questions: unknown[] | null;
    takeaways: unknown[] | null;
    takeaways_es: unknown[] | null;
    resource_urls: unknown[] | null;
    masterclass_id: string | null;
    is_standalone: boolean | null;
    stripe_product_id: string | null;
    price_id: string | null;
    title_es: string | null;
    subtitle_es: string | null;
    description_es: string | null;
    created_at: string | null;
    updated_at: string | null;
    // Supabase join alias (masterclass:masterclasses(title)); may be object or array.
    masterclasses?: { title: string } | { title: string }[] | null;
}

export interface Masterclass {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    thumbnail_url: string | null;
    video_url: string | null;
    order_index: number | null;
    stripe_product_id: string | null;
    price_id: string | null;
    title_es: string | null;
    subtitle_es: string | null;
    description_es: string | null;
    takeaways_es: unknown;
    created_at: string;
    updated_at: string;
}

export interface Service {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    price_display: string | null;
    price_id: string | null;
    stripe_url: string | null;
    stripe_product_id: string | null;
    image_url: string | null;
    type: string | null;
    recommendation_tags: string[] | null;
    active: boolean | null;
    order_index: number | null;
    unlocks_studio_access: boolean | null;
    title_es: string | null;
    subtitle_es: string | null;
    description_es: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface BoutiqueItem {
    id: string;
    brand_id: string | null;
    name: string;
    image_url: string;
    curator_note: string | null;
    curator_note_es: string | null;
    affiliate_url_usa: string | null;
    affiliate_url_es: string | null;
    category: string | null;
    order_index: number | null;
    active: boolean | null;
    created_at: string | null;
    updated_at: string | null;
    // Supabase join alias (brand:partner_brands(name)).
    brand?: { name: string } | null;
}

export interface PartnerBrand {
    id: string;
    name: string;
    logo_url: string | null;
    website_url: string | null;
    order_index: number | null;
    active: boolean | null;
    contact_name: string | null;
    contact_email: string | null;
    commission_rate: number | null;
    partnership_status: string;
    internal_notes: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface BoutiqueCollection {
    id: string;
    title: string;
    title_es: string | null;
    description: string | null;
    description_es: string | null;
    cover_image_url: string | null;
    active: boolean;
    order_index: number;
    created_at: string;
    updated_at: string;
    items?: Array<{ item_id: string;[key: string]: unknown }>;
}

export interface TrustedLogo {
    id: string;
    name: string;
    logo_url: string;
    order_index: number;
    active: boolean;
    created_at: string;
}

export interface Offer {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    price_display: string | null;
    stripe_product_id: string | null;
    price_id: string | null;
    active: boolean | null;
    title_es: string | null;
    description_es: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface UserQuestion {
    id: string;
    user_id: string;
    question: string;
    answer: string | null;
    status: string | null;
    created_at: string | null;
    answered_at: string | null;
}

export interface EssenceResponse {
    id: string;
    user_id: string;
    masterclass_id: string | null;
    chapter_id: string | null;
    chapter_slug: string | null;
    question_key: string;
    answer_value: unknown;
    response_value?: unknown; // legacy alias some rows/readers use
    context_metadata: unknown;
    created_at: string | null;
    updated_at: string | null;
}
