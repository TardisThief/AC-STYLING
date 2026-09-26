/**
 * Move paid downloads out of the PUBLIC vault-assets bucket into the private
 * vault-resources bucket, and point their resource_urls items at the new path.
 *
 *   node scripts/ops/move_public_resources.mjs            # dry run: report only
 *   node scripts/ops/move_public_resources.mjs --apply    # do it
 *
 * Part of MEDIA-001 (2026-09-25 external assessment; owner decision
 * 2026-09-26: paid-only). Run AFTER migration 30 and after the code that reads
 * `{ name, path }` items is deployed: before that, a rewritten item renders no
 * link.
 *
 * For each masterclass and chapter resource whose url is a public vault-assets
 * object URL, in this order, so an interruption never leaves a dead link:
 *   1. copy the object into vault-resources under the same key;
 *   2. confirm the copy exists;
 *   3. rewrite that item to { name, path } (other items untouched);
 *   4. delete the public copy.
 * Anything else — external links, items already moved — is left alone.
 * Idempotent: a re-run finds nothing left to move.
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });

const APPLY = process.argv.includes('--apply');
const FROM = 'vault-assets';
const TO = 'vault-resources';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const admin = createClient(url, key, { auth: { persistSession: false } });

const publicPrefix = `${url.replace(/\/$/, '')}/storage/v1/object/public/${FROM}/`;

/** The vault-assets object key a public URL points at, or null. */
function publicKey(itemUrl) {
    if (typeof itemUrl !== 'string' || !itemUrl.startsWith(publicPrefix)) return null;
    const keyPart = decodeURIComponent(itemUrl.slice(publicPrefix.length).split('?')[0]);
    return keyPart && !keyPart.includes('/') && !keyPart.includes('..') ? keyPart : null;
}

async function exists(bucket, objectKey) {
    const { data, error } = await admin.storage.from(bucket).list('', { search: objectKey, limit: 100 });
    if (error) throw new Error(`list ${bucket}: ${error.message}`);
    return (data ?? []).some(o => o.name === objectKey);
}

async function moveTable(table) {
    const { data: rows, error } = await admin.from(table).select('id, title, resource_urls');
    if (error) throw new Error(`read ${table}: ${error.message}`);

    let moved = 0;
    for (const row of rows ?? []) {
        const items = Array.isArray(row.resource_urls) ? row.resource_urls : [];
        const toMove = items.map((item, i) => ({ item, i, objectKey: publicKey(item?.url) })).filter(x => x.objectKey);
        if (toMove.length === 0) continue;

        for (const { item, i, objectKey } of toMove) {
            console.log(`${APPLY ? 'MOVE' : 'WOULD MOVE'} ${table} "${row.title}" [${i}] "${item.name}": ${FROM}/${objectKey} -> ${TO}/${objectKey}`);
            if (!APPLY) continue;

            if (!(await exists(TO, objectKey))) {
                const { data: blob, error: dlError } = await admin.storage.from(FROM).download(objectKey);
                if (dlError || !blob) throw new Error(`download ${objectKey}: ${dlError?.message}`);
                const { error: upError } = await admin.storage.from(TO).upload(objectKey, blob, {
                    contentType: blob.type || 'application/octet-stream',
                    upsert: false,
                });
                if (upError) throw new Error(`upload ${objectKey}: ${upError.message}`);
            }
            if (!(await exists(TO, objectKey))) throw new Error(`copy of ${objectKey} not found after upload`);

            // Re-read and rewrite only this item, so a concurrent admin edit
            // to the other items is not overwritten with a stale copy.
            const { data: fresh, error: reError } = await admin.from(table).select('resource_urls').eq('id', row.id).single();
            if (reError) throw new Error(`re-read ${table} ${row.id}: ${reError.message}`);
            const next = (fresh.resource_urls ?? []).map(r => (publicKey(r?.url) === objectKey ? { name: r.name, path: objectKey } : r));
            const { error: wError } = await admin.from(table).update({ resource_urls: next }).eq('id', row.id);
            if (wError) throw new Error(`write ${table} ${row.id}: ${wError.message}`);

            const { error: rmError } = await admin.storage.from(FROM).remove([objectKey]);
            if (rmError) throw new Error(`remove public ${objectKey}: ${rmError.message} (the item already points at the private copy)`);
            moved++;
        }
    }
    return moved;
}

const { data: bucket } = await admin.storage.getBucket(TO);
if (!bucket) throw new Error(`bucket ${TO} does not exist: apply migration 30 first`);
if (bucket.public) throw new Error(`bucket ${TO} is public; refusing`);

const moved = (await moveTable('masterclasses')) + (await moveTable('chapters'));
console.log(APPLY ? `Done: moved ${moved}.` : 'Dry run: nothing changed. Re-run with --apply.');
