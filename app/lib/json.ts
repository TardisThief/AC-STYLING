/**
 * Reading jsonb columns without pretending to know their shape.
 *
 * The generated schema types (lib/database.types.ts) type every jsonb column
 * as `Json`, which is the truth: the database does not promise an array, a
 * string or an object. These narrow a value to the shape a reader needs, and
 * fall back to empty instead of throwing, which is how the UI already treated
 * a missing value.
 */
import type { Json } from '@/lib/database.types';

type MaybeJson = Json | undefined | null;

/** The value as a list, or an empty one. */
export function jsonArray(value: MaybeJson): Json[] {
    return Array.isArray(value) ? value : [];
}

/** The value as a list of strings, keeping only the entries that are text. */
export function jsonStrings(value: MaybeJson): string[] {
    return jsonArray(value).filter((v): v is string => typeof v === 'string');
}

/** The value as text: strings as they are, numbers and booleans spelled out, anything else empty. */
export function jsonText(value: MaybeJson): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

/** A flat object of text values (e.g. measurements), or an empty one. */
export function jsonTextRecord(value: MaybeJson): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string' || typeof v === 'number') out[k] = String(v);
    }
    return out;
}

/** A list of `{name, url?, path?}` downloads, keeping only well-formed entries. */
export function jsonResources(value: MaybeJson): { name: string; url?: string; path?: string }[] {
    return jsonArray(value).flatMap((v) => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return [];
        const { name, url, path } = v as Record<string, Json | undefined>;
        if (typeof name !== 'string') return [];
        return [{ name, ...(typeof url === 'string' ? { url } : {}), ...(typeof path === 'string' ? { path } : {}) }];
    });
}
