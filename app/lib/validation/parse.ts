import { z } from 'zod';

/**
 * Result of validating action input. Mirrors GuardResult (auth-guards.ts) so
 * actions read: guard → parse → write, each returning early on failure.
 */
export type ParseResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

/**
 * Validate `input` against `schema`. On failure, flattens every issue into one
 * human-readable sentence — the admin forms surface it via toast.error(res.error).
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>> {
    const result = schema.safeParse(input);
    if (result.success) return { ok: true, data: stripUndefined(result.data) };

    const messages = [...new Set(result.error.issues.map(issue => issue.message))];
    return { ok: false, error: `Please fix the following: ${messages.join('; ')}` };
}

/**
 * Drop keys whose value is undefined: zod keeps a key present in its output
 * when the input had it, even if the schema resolved it to undefined (e.g.
 * upsertId on ''). Stripping here makes "absent key = column untouched" an
 * explicit guarantee of validated payloads, not a JSON-serializer detail.
 */
function stripUndefined<T>(data: T): T {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const record = data as Record<string, unknown>;
        for (const key of Object.keys(record)) {
            if (record[key] === undefined) delete record[key];
        }
    }
    return data;
}

// --- Shared field primitives ---
// Schema output keys are DB column names, so actions can write parsed.data as-is.

/** Non-empty trimmed string; "<Label> is required" on missing/empty/wrong type. */
export const requiredText = (label: string) =>
    z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`);

/**
 * Optional free text: trims; absent/null/empty all become null — matches the
 * `data.x || null` behavior the actions had before.
 */
export const optionalText = z
    .string()
    .nullish()
    .transform(value => {
        const trimmed = value?.trim();
        return trimmed ? trimmed : null;
    });

/**
 * Like optionalText, but an ABSENT key stays absent so partial payloads (the
 * offers/services upserts, TrustedBy toggles) don't null-overwrite columns the
 * form never sent. Present-but-empty still becomes null.
 */
export const optionalTextPreserve = optionalText.optional();

/** Optional number: coerces numeric strings; ''/null/undefined → null; NaN → error. */
export const optionalNumber = (label: string) =>
    z.preprocess(
        value => (value === '' || value === null || value === undefined ? null : value),
        z.coerce.number({ error: `${label} must be a number` }).nullable(),
    );

/** Whole-number ordering index; ''/null/undefined default to 0. */
export const orderIndex = z.preprocess(
    value => (value === '' || value === null || value === undefined ? 0 : value),
    z.coerce.number({ error: 'Order must be a number' }).int('Order must be a whole number'),
);

/** UUID with a friendly error naming the record. */
export const uuid = (label: string) => z.uuid({ error: `${label} is invalid` });

/** UUID or null; ''/null/undefined → null (forms send '' for "none"). */
export const optionalUuid = (label: string) =>
    z.preprocess(
        value => (value === '' || value === null || value === undefined ? null : value),
        uuid(label).nullable(),
    );

/** UUID or absent; ''/null → absent so an upsert's insert path uses the DB default id. */
export const upsertId = (label: string) =>
    z.preprocess(
        value => (value === '' || value === null ? undefined : value),
        uuid(label).optional(),
    );

/**
 * A jsonb array column fed either a real array or a JSON string from a form
 * field. Malformed JSON becomes a validation issue instead of a thrown error.
 */
export const jsonArray = (label: string) =>
    z.preprocess((value, ctx) => {
        if (value === '' || value === null || value === undefined) return [];
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                ctx.addIssue({ code: 'custom', message: `${label} contains invalid JSON` });
                return z.NEVER;
            }
        }
        return value;
    }, z.array(z.unknown(), { error: `${label} must be a list` }));

/** Boolean from a form value: true/'true' → true, anything else → false. */
export const booleanish = z.preprocess(
    value => value === true || value === 'true',
    z.boolean(),
);
