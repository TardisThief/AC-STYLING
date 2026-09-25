// @vitest-environment node
/**
 * The adapter the fulfillment tests stand on. If it were permissive, those
 * tests could pass by the adapter agreeing with the code; these pin that it
 * refuses what it does not implement and reports what Postgres reports.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const user = '00000000-0000-4000-8000-00000000b001';
let db: PGlite;

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await createUser(db, user);
}, 60000);
afterAll(async () => { await db?.close(); });

describe('pglite-supabase', () => {
    it('surfaces a real unique violation as 23505', async () => {
        const client = pgliteSupabase(db);
        await client.from('offers').insert({ slug: 'dup', title: 'A' });
        const { error } = await client.from('offers').insert({ slug: 'dup', title: 'B' });
        expect(error?.code).toBe('23505');
    });

    it('returns only inserted rows from an ignoreDuplicates upsert', async () => {
        const client = pgliteSupabase(db);
        const first = await client.from('stripe_processed_events').upsert({ event_id: 'e1' }, { onConflict: 'event_id', ignoreDuplicates: true }).select('event_id');
        const second = await client.from('stripe_processed_events').upsert({ event_id: 'e1' }, { onConflict: 'event_id', ignoreDuplicates: true }).select('event_id');
        expect(first.data).toEqual([{ event_id: 'e1' }]);
        expect(second.data).toEqual([]);
    });

    it('errors on maybeSingle over several rows, as PostgREST does', async () => {
        const client = pgliteSupabase(db);
        await client.from('offers').insert({ slug: 'm1', title: 'same' });
        await client.from('offers').insert({ slug: 'm2', title: 'same' });
        const { data, error } = await client.from('offers').select('slug').eq('title', 'same').maybeSingle();
        expect(data).toBeNull();
        expect(error?.code).toBe('PGRST116');
    });

    it('enforces RLS when acting as a signed-in user', async () => {
        const client = pgliteSupabase(db, 'authenticated', user);
        const { error } = await client.from('user_access_grants').insert({ user_id: user, offer_slug: 'full_access' });
        expect(error?.code).toBe('42501');
    });

    it('refuses builder calls it does not implement', () => {
        const builder = pgliteSupabase(db).from('offers').select('slug') as unknown as Record<string, unknown>;
        expect(builder.order).toBeUndefined();
        expect(() => pgliteSupabase(db).from('offers').select('slug, profiles:owner_id (email)')).not.toThrow();
        expect(() => pgliteSupabase(db).rpc).toThrow(/not implemented/);
    });

    it('refuses options it does not understand instead of ignoring them', () => {
        expect(() => pgliteSupabase(db).from('offers').upsert({ slug: 'x' }, { onConflict: 'slug', count: 'exact' } as never)).toThrow(/unsupported upsert option/);
        expect(() => pgliteSupabase(db).from('offers').select('slug', { count: 'planned' } as never)).toThrow(/count/);
    });

    it('refuses embedded-relation selects when they run', async () => {
        await expect(pgliteSupabase(db).from('offers').select('slug, profiles:owner_id (email)')).rejects.toThrow(/unsupported identifier/);
    });
});
