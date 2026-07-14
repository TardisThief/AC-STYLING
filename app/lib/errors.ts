/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * Server actions catch errors and surface `.message` to the client. With
 * TypeScript's `useUnknownInCatchVariables`, a caught value is `unknown`, so
 * narrow it here instead of typing the catch binding as `any`.
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error);
}
