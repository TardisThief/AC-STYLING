// @vitest-environment node
/**
 * What a Studio client's own browser can save, against the live schema.
 *
 * The client view (ClientStudioDashboard) lets her edit her measurements
 * (TailorCardUser) and her items' category, brand, tags and note
 * (VirtualWardrobe with isClientView). Both wrote straight from the browser,
 * as `authenticated`. The comment beside the item write said "RLS already
 * scopes it to rows it owns" — but members have no UPDATE policy on
 * wardrobe_items and no write policy on tailor_cards at all.
 *
 * An UPDATE that RLS filters out is not an error: it updates nothing and
 * reports success. So her item edits looked saved and were gone on reload.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser } from '../utils/pglite-db';

const CLIENT = '00000000-0000-4000-8000-00000000d001';
const WARDROBE = '00000000-0000-4000-8000-00000000d101';
const ITEM = '00000000-0000-4000-8000-00000000d201';
let db: PGlite;

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await createUser(db, CLIENT, { active_studio_client: true });
    await db.query('INSERT INTO wardrobes (id, owner_id) VALUES ($1, $2)', [WARDROBE, CLIENT]);
    await db.query(`INSERT INTO wardrobe_items (id, wardrobe_id, user_id, image_url, client_note) VALUES ($1, $2, $3, 'x', 'before')`, [ITEM, WARDROBE, CLIENT]);
}, 120_000);

afterAll(async () => { await db?.close(); });

describe('A Studio client’s own edits, written from her browser', () => {
    it.fails('saves her measurements', async () => {
        await asRole(db, 'authenticated', CLIENT,
            `INSERT INTO tailor_cards (user_id, measurements) VALUES ($1, '{"waist":"70"}')
             ON CONFLICT (user_id) DO UPDATE SET measurements = EXCLUDED.measurements RETURNING id`, [CLIENT]);
    });

    it.fails('saves her note on one of her items', async () => {
        const { rows } = await asRole(db, 'authenticated', CLIENT,
            `UPDATE wardrobe_items SET client_note = 'after' WHERE id = $1 RETURNING id`, [ITEM]);
        expect(rows).toHaveLength(1);
    });
});
