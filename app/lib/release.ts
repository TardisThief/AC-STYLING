/**
 * What is open to members in the current release.
 *
 * Release 1 is the learning platform. The boutique — and the dashboard tiles
 * that feed from it (Style of the Week, Ale's Pick, "The Edit" in the Pulse) —
 * is built but held back until there is editorial content to put in it. None
 * of that code is removed; it is switched off here, in one place.
 *
 * To open the boutique: set `BOUTIQUE_OPEN=true` in Vercel and redeploy.
 * Server-only on purpose (no `NEXT_PUBLIC_`): read it in server components and
 * actions, and pass the result down as a prop.
 */

import { isEnabled } from './env-flags';

export function isBoutiqueOpen(): boolean {
    return isEnabled(process.env.BOUTIQUE_OPEN);
}

/** Admins can browse the boutique while it is closed, so they can keep curating it. */
export function canBrowseBoutique(role?: string | null): boolean {
    return isBoutiqueOpen() || role === 'admin';
}
