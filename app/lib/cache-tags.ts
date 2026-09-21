/**
 * Cache tag names, kept free of side effects.
 *
 * These live apart from the modules that read through them because those
 * modules do work at import time — `app/lib/vault-catalog.ts` calls
 * `unstable_cache(...)` as it loads. Importing a constant from there drags that
 * call into every consumer, which is how adding one tag invalidation to the
 * admin actions broke two unrelated test files whose `next/cache` mock had no
 * reason to stub `unstable_cache`.
 *
 * A name is just a string. It should not require a cache to import.
 */

/** The public Vault catalogue: masterclasses, modules and standalone courses. */
export const VAULT_CATALOG_TAG = 'vault-catalog';
