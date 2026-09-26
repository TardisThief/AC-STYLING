// @vitest-environment node
/**
 * The homepage "trusted by" logos, against the live schema.
 *
 * The write policy was named "admin write" but checked only
 * `auth.role() = 'authenticated'`, and the table grants INSERT/UPDATE/DELETE
 * to every signed-in user — so anyone who created an account could replace
 * the brand logos on the public homepage straight through PostgREST. Found by
 * the 2026-09-25 external assessment (SEC-002).
 *
 * The admin console writes these through the admin's own session client
 * (app/actions/admin/manage-boutique.ts), so the fix must keep admin writes
 * working, not just refuse everyone.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser } from '../utils/pglite-db';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MEMBER = id(1);
const ADMIN = id(2);
const LOGO = id(100);

let db: PGlite;

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await createUser(db, MEMBER);
    await createUser(db, ADMIN, { role: 'admin' });
    await db.query(
        `INSERT INTO trusted_by_logos (id, name, logo_url) VALUES ($1, 'Real Brand', 'https://theacstyle.com/logo.png')`,
        [LOGO]
    );
}, 60000);

afterAll(async () => { await db?.close(); });

describe('trusted_by_logos writes', () => {
    it.fails('refuses a signed-in member inserting a logo', async () => {
        await expect(asRole(db, 'authenticated', MEMBER,
            `INSERT INTO trusted_by_logos (name, logo_url) VALUES ('Injected', 'https://attacker.invalid/x.png') RETURNING id`
        )).rejects.toMatchObject({ code: '42501' });
    });

    it.fails('refuses a signed-in member changing a logo', async () => {
        const result = await asRole(db, 'authenticated', MEMBER,
            `UPDATE trusted_by_logos SET logo_url = 'https://attacker.invalid/x.png' WHERE id = $1 RETURNING id`, [LOGO]);
        expect(result.rows).toEqual([]);
    });

    it.fails('refuses a signed-in member deleting a logo', async () => {
        const result = await asRole(db, 'authenticated', MEMBER,
            `DELETE FROM trusted_by_logos WHERE id = $1 RETURNING id`, [LOGO]);
        expect(result.rows).toEqual([]);
    });

    it('refuses anonymous writes', async () => {
        await expect(asRole(db, 'anon', null,
            `INSERT INTO trusted_by_logos (name, logo_url) VALUES ('Injected', 'https://attacker.invalid/x.png')`
        )).rejects.toMatchObject({ code: '42501' });
    });

    it('lets the admin add, change and remove logos', async () => {
        const inserted = await asRole(db, 'authenticated', ADMIN,
            `INSERT INTO trusted_by_logos (name, logo_url) VALUES ('New', 'https://theacstyle.com/new.png') RETURNING id`);
        expect(inserted.rows).toHaveLength(1);
        const updated = await asRole(db, 'authenticated', ADMIN,
            `UPDATE trusted_by_logos SET name = 'Renamed' WHERE id = $1 RETURNING id`, [LOGO]);
        expect(updated.rows).toHaveLength(1);
        const deleted = await asRole(db, 'authenticated', ADMIN,
            `DELETE FROM trusted_by_logos WHERE id = $1 RETURNING id`, [LOGO]);
        expect(deleted.rows).toHaveLength(1);
    });

    it('still shows the logos to everyone', async () => {
        const result = await asRole(db, 'anon', null, `SELECT name FROM trusted_by_logos WHERE id = $1`, [LOGO]);
        expect(result.rows).toEqual([{ name: 'Real Brand' }]);
    });
});
