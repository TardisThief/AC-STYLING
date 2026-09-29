// @vitest-environment node
/**
 * Migration 36: a lookbook is owned by its wardrobe, and services have a
 * Spanish price.
 *
 * A lookbook recorded two owners, user_id and wardrobe_id, and the member
 * read policy honoured either. So after a wardrobe moved to another client
 * (assignWardrobe; the wardrobe outlives the client, migration 33), the
 * previous client still read its published lookbooks through user_id. The
 * wardrobe is the owner now; user_id is gone.
 *
 * Against the live schema: set the old state up, apply the file, check who
 * sees what. The same checks without the file fail.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser, readMigration } from '../utils/pglite-db';

const MIGRATION = '20260929_36_service_price_es_and_lookbook_owner.sql';
const id = (n: number) => `00000000-0000-4000-8000-${String(0xf600 + n).padStart(12, '0')}`;
const OWNER = id(1), FORMER = id(2), OTHER = id(3), ADMIN = id(4);
const W = id(10);
const PUBLISHED = id(20), DRAFT = id(21);

let db: PGlite;

async function visibleTo(user: string): Promise<string[]> {
    const { rows } = await asRole<{ id: string }>(db, 'authenticated', user, 'SELECT id FROM lookbooks ORDER BY id');
    return rows.map((r) => r.id);
}

beforeAll(async () => {
    db = await createLiveSchemaDb();
    for (const u of [OWNER, FORMER, OTHER]) await createUser(db, u);
    await createUser(db, ADMIN, { role: 'admin' });
    // The wardrobe was FORMER's and has been reassigned to OWNER; the
    // lookbooks were made while it was FORMER's, so they carry her user_id.
    await db.query(`INSERT INTO wardrobes (id, owner_id, title, status) VALUES ($1, $2, 'W', 'active')`, [W, OWNER]);
    await db.query(
        `INSERT INTO lookbooks (id, user_id, wardrobe_id, title, status) VALUES
            ($1, $3, $4, 'Autumn', 'Published'), ($2, $3, $4, 'Winter', 'Draft')`,
        [PUBLISHED, DRAFT, FORMER, W]);

    await db.exec(readMigration(MIGRATION));
}, 60000);

afterAll(async () => { await db?.close(); });

describe('a lookbook belongs to its wardrobe', () => {
    it("the wardrobe's owner sees its published lookbook, not its draft", async () => {
        expect(await visibleTo(OWNER)).toEqual([PUBLISHED]);
    });

    it('the client the wardrobe used to belong to no longer does', async () => {
        expect(await visibleTo(FORMER)).toEqual([]);
    });

    it('nobody else does', async () => {
        expect(await visibleTo(OTHER)).toEqual([]);
    });

    it('an admin sees them all', async () => {
        expect(await visibleTo(ADMIN)).toEqual([PUBLISHED, DRAFT]);
    });

    it('a lookbook cannot exist without a wardrobe', async () => {
        await expect(db.query(`INSERT INTO lookbooks (title) VALUES ('Loose')`)).rejects.toMatchObject({ code: '23502' });
    });

    it('has no user_id any more', async () => {
        const { rows } = await db.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'lookbooks' AND column_name = 'user_id'");
        expect(rows).toEqual([]);
    });
});

describe('a Spanish service price', () => {
    it('has its column, readable by anyone who can read the price', async () => {
        await db.query(`INSERT INTO services (title, price_display, price_display_es) VALUES ('Session', 'From $250', 'Desde $250')`);
        const { rows } = await asRole<{ price_display_es: string }>(db, 'anon', null, "SELECT price_display_es FROM services WHERE title = 'Session'");
        expect(rows).toEqual([{ price_display_es: 'Desde $250' }]);
    });
});

describe('the file', () => {
    it('refuses to run twice', async () => {
        await expect(db.exec(readMigration(MIGRATION))).rejects.toThrow(/has been applied/);
        await db.exec('ROLLBACK');
    });
});
