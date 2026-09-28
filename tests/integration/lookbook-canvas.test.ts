// @vitest-environment node
/**
 * Migration 35: a lookbook is stored one way, as a canvas of references.
 *
 * Applied to production 2026-09-28 and in the baseline since; the
 * reproduce-then-apply proof (a snapshot canvas normalised, 4 of 5 failing
 * without the file) is in git history and supabase/migrations/README.md.
 *
 * ARCH-001 (2026-09-25 assessment). Two representations: the canvas JSON the
 * app uses, whose entries snapshotted the whole garment, and a join table
 * (lookbook_items) nothing but the legacy clone_lookbook() read. Against the
 * live schema: reproduce a snapshot canvas, apply the file, and check it is
 * references only, and that the table and both SECURITY DEFINER functions are
 * gone.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser, expectMigrationApplied } from '../utils/pglite-db';

const MIGRATION = '20260928_35_one_lookbook_canvas.sql';
let db: PGlite;
const U = '00000000-0000-4000-8000-00000000f001';
const W = '00000000-0000-4000-8000-00000000f002';
const ITEM = '00000000-0000-4000-8000-00000000f003';
const LB = '00000000-0000-4000-8000-00000000f004';

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await expectMigrationApplied(db, MIGRATION);
    await createUser(db, U);
    await db.query(`INSERT INTO wardrobes (id, owner_id, title, status) VALUES ($1, $2, 'W', 'active')`, [W, U]);
    await db.query(`INSERT INTO wardrobe_items (id, user_id, wardrobe_id, image_url, category) VALUES ($1, $2, $3, 'u/a.jpg', 'Tops')`, [ITEM, U, W]);
    await db.query(`INSERT INTO lookbooks (id, user_id, wardrobe_id, title, lookbook_items) VALUES ($1, $2, $3, 'Autumn', $4::jsonb)`,
        [LB, U, W, JSON.stringify([{ id: ITEM, x: 40, y: 60, width: 150 }])]);
}, 60000);

afterAll(async () => { await db?.close(); });

describe('one way to store a lookbook', () => {
    it('holds a canvas of references', async () => {
        const { rows } = await db.query<{ lookbook_items: unknown }>('SELECT lookbook_items FROM lookbooks WHERE id = $1', [LB]);
        expect(rows[0].lookbook_items).toEqual([{ id: ITEM, x: 40, y: 60, width: 150 }]);
    });

    it('has no join table', async () => {
        const { rows } = await db.query<{ t: string | null }>("SELECT to_regclass('public.lookbook_items')::text AS t");
        expect(rows[0].t).toBeNull();
    });

    it('has no clone functions', async () => {
        const { rows } = await db.query("SELECT proname FROM pg_proc WHERE proname IN ('clone_lookbook', 'clone_wardrobe_item')");
        expect(rows).toEqual([]);
    });
});
