/**
 * The user wipe, as logic with no I/O of its own.
 *
 * Everything takes `query(sql, params) -> { rows }`, which both `pg` and PGlite
 * provide, so the exact statements the CLI (scripts/wipe_users.mjs) runs
 * against production are the ones tests/integration/wipe-users.test.ts runs
 * against the live schema in PGlite.
 *
 * What a wipe removes, and why each step is here rather than left to cascades:
 *
 *   - auth.users for every non-kept user. Deleting the auth row cascades to
 *     profiles, purchase_claims, grants, progress, essence responses,
 *     questions, saves, tailor cards, lookbooks and the user's own wardrobe
 *     items (baseline FKs, migration 15). purchases and fulfillments are NOT
 *     removed since migration 32: they are detached (user_id NULL) and kept,
 *     so a later account with the same email cannot Restore the wiped
 *     account's guest purchases, and the sales record survives.
 *   - wardrobes owned by those users, explicitly. wardrobes.owner_id is
 *     ON DELETE SET NULL, so a cascade would leave ownerless shells, and the
 *     guest-intake items in them (user_id NULL) would survive.
 *   - admin_notifications about those users, explicitly. user_id is
 *     ON DELETE SET NULL and a sale notice keeps the buyer's name, email and
 *     phone in metadata, so a cascade would keep their personal data.
 *
 * What it keeps: every admin (profiles.role = 'admin'), anyone listed in
 * keepEmails, and all catalog content (masterclasses, chapters, offers,
 * services, boutique, partner brands, logos). Operational logs
 * (webhook_events, stripe_processed_events, rate_limits, payment-review
 * notices) are kept unless clearLogs is set; webhook_events payloads carry
 * checkout emails, so a wipe that is also a privacy reset should clear them.
 */

/**
 * @typedef {(sql: string, params?: unknown[]) => Promise<{ rows: any[] }>} Query
 * @typedef {{ id: string, email: string | null, role: string }} Account
 * @typedef {{ kept: Account[], wiped: Account[] }} WipePlan
 */

/**
 * Who goes and who stays. Throws rather than plan a wipe that locks everyone out.
 * @param {Query} query
 * @param {{ keepEmails?: string[] }} [options]
 * @returns {Promise<WipePlan>}
 */
export async function planWipe(query, { keepEmails = [] } = {}) {
    const keep = keepEmails.map(e => e.trim().toLowerCase()).filter(Boolean);
    const { rows } = await query(
        `SELECT u.id::text AS id, lower(u.email) AS email, coalesce(p.role, 'user') AS role
         FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
         ORDER BY u.email`
    );

    const kept = rows.filter(r => r.role === 'admin' || keep.includes(r.email ?? ''));
    const wiped = rows.filter(r => !kept.includes(r));

    if (!kept.some(r => r.role === 'admin')) {
        throw new Error('Refusing: no admin account would remain after the wipe.');
    }
    const unknownKeeps = keep.filter(e => !rows.some(r => r.email === e));
    if (unknownKeeps.length) {
        throw new Error(`Refusing: --keep lists accounts that do not exist: ${unknownKeeps.join(', ')}`);
    }

    return { kept, wiped };
}

/**
 * Row counts for every public table, plus auth.users.
 * @param {Query} query
 * @returns {Promise<Record<string, number>>}
 */
export async function tableCounts(query) {
    const { rows: tables } = await query(
        `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`
    );
    const counts = {};
    for (const { name } of tables) {
        const { rows } = await query(`SELECT count(*)::int AS n FROM public."${name.replace(/"/g, '""')}"`);
        counts[name] = rows[0].n;
    }
    counts['auth.users'] = (await query('SELECT count(*)::int AS n FROM auth.users')).rows[0].n;
    return counts;
}

/**
 * Delete. Run inside the caller's transaction: the CLI rolls it back for a
 * dry run and commits it only when told to.
 *
 * Returns the storage folders that belonged to the wiped users, for
 * wipeStorage, which cannot be part of the transaction.
 * @param {Query} query
 * @param {WipePlan} plan
 * @param {{ clearLogs?: boolean, includeOwnerlessWardrobes?: boolean }} [options]
 * @returns {Promise<{ storageFolders: Record<string, string[]> }>}
 */
export async function applyWipe(query, plan, { clearLogs = false, includeOwnerlessWardrobes = false } = {}) {
    const ids = plan.wiped.map(u => u.id);
    const emails = plan.wiped.map(u => u.email).filter(Boolean);

    // Wardrobe ids, captured before the rows go: their intake folders are
    // named after them, not after a user.
    const { rows: wardrobes } = await query(
        `SELECT id::text AS id FROM public.wardrobes
         WHERE owner_id = ANY($1::uuid[]) ${includeOwnerlessWardrobes ? 'OR owner_id IS NULL' : ''}`,
        [ids]
    );
    const wardrobeIds = wardrobes.map(w => w.id);

    if (ids.length) {
        await query(
            `DELETE FROM public.admin_notifications
             WHERE user_id = ANY($1::uuid[])
                OR metadata->>'original_user_id' = ANY($1::text[])
                OR lower(metadata->>'email') = ANY($2::text[])`,
            [ids, emails]
        );
    }
    if (wardrobeIds.length) {
        await query('DELETE FROM public.wardrobes WHERE id = ANY($1::uuid[])', [wardrobeIds]);
    }
    if (ids.length) {
        await query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [ids]);
    }

    if (clearLogs) {
        await query('DELETE FROM public.webhook_events');
        await query('DELETE FROM public.stripe_processed_events');
        await query('DELETE FROM public.rate_limits');
        await query("DELETE FROM public.admin_notifications WHERE type = 'payment_review'");
    }

    // Anything still pointing at a wiped id means a table this script does not
    // know about. Fail the transaction rather than report a clean wipe.
    const { rows: leftovers } = await query(
        `SELECT 'wardrobes' AS t, count(*)::int AS n FROM public.wardrobes WHERE owner_id = ANY($1::uuid[])
         UNION ALL SELECT 'admin_notifications', count(*)::int FROM public.admin_notifications WHERE user_id = ANY($1::uuid[])
         UNION ALL SELECT 'profiles', count(*)::int FROM public.profiles WHERE id = ANY($1::uuid[])`,
        [ids]
    );
    const left = leftovers.filter(r => r.n > 0);
    if (left.length) throw new Error(`Wipe incomplete: ${left.map(r => `${r.t}=${r.n}`).join(', ')}`);

    return {
        storageFolders: {
            'studio-wardrobe': [
                ...ids.map(id => id),
                ...ids.map(id => `wardrobe/${id}`),
                ...wardrobeIds.map(id => `wardrobe/${id}`),
            ],
            avatars: ids,
        },
    };
}

/** Every object path under `folder`, recursively, via the Storage API's list(). */
async function listRecursive(bucket, folder) {
    const out = [];
    for (let offset = 0; ; offset += 100) {
        const { data, error } = await bucket.list(folder, { limit: 100, offset });
        if (error) throw new Error(`list ${folder}: ${error.message}`);
        if (!data?.length) break;
        for (const entry of data) {
            const path = `${folder}/${entry.name}`;
            // A folder has no id in Supabase's listing.
            if (entry.id === null || entry.id === undefined) out.push(...await listRecursive(bucket, path));
            else out.push(path);
        }
        if (data.length < 100) break;
    }
    return out;
}

/**
 * Remove the wiped users' files. Through the Storage API, never by deleting
 * storage.objects rows, which would leave the bytes orphaned in the bucket.
 * Idempotent: re-running after a partial failure removes what is left.
 * @param {{ from(bucket: string): any }} storage
 * @param {Record<string, string[]>} folders
 * @param {{ commit?: boolean }} [options]
 * @returns {Promise<Record<string, number>>}
 */
export async function wipeStorage(storage, folders, { commit = false } = {}) {
    const report = {};
    for (const [bucketName, list] of Object.entries(folders)) {
        const bucket = storage.from(bucketName);
        const paths = [];
        for (const folder of [...new Set(list)]) paths.push(...await listRecursive(bucket, folder));
        report[bucketName] = paths.length;
        if (!commit) continue;
        for (let i = 0; i < paths.length; i += 100) {
            const { error } = await bucket.remove(paths.slice(i, i + 100));
            if (error) throw new Error(`remove from ${bucketName}: ${error.message}`);
        }
    }
    return report;
}
