/**
 * Leave a browser-side sign-in or sign-out with a full page load, never
 * `router.push`/`router.replace`.
 *
 * A session change done in the browser (password, anonymous, a magic-link
 * hash, sign-out) sets or clears the cookie without telling the Next router,
 * whose client cache keeps rendering the old state. Going in: `/vault/join` is
 * public, shares the Vault layout, and is prefetched from the login and sales
 * pages, so a push into the Vault after signing in reused a signed-out layout
 * and the navbar's Profile link pointed at /vault/join until a reload (found
 * in the 2026-09-28 rehearsal, reproduced on the live site). Going out, the
 * cache still holds her signed-in pages for Back. `router.refresh()` only
 * clears the current route, so it reaches neither; a full load is the one
 * thing that renders the whole tree with the new cookie.
 *
 * Sign-ins done inside a server action (the /welcome password form) do not
 * need this: setting a cookie in an action already invalidates the cache.
 *
 * `path` must already be safe (see `safeNextPath`) and locale-prefixed.
 * `replace` keeps a one-shot page (the confirm screen) out of her history, so
 * Back does not run it again.
 */
export function navigateAfterAuthChange(path: string, { replace = false } = {}): void {
    if (replace) window.location.replace(path);
    else window.location.assign(path);
}
