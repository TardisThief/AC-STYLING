// @vitest-environment node
/**
 * auth_user_id_by_email (migration 31), against the live schema.
 *
 * It replaces paging through listUsers, which stopped at the 2,000th account
 * (SCALE-001). It reads auth.users with SECURITY DEFINER, so who may call it
 * matters as much as what it returns: open to members or anon, it would tell
 * anyone whether an address has an account here.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser, readMigration } from '../utils/pglite-db';

const BUYER = '00000000-0000-4000-8000-00000000f001';
let db: PGlite;

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await createUser(db, BUYER);
    await db.query('UPDATE auth.users SET email = $1 WHERE id = $2', ['buyer@example.invalid', BUYER]);
    await db.exec(readMigration('20260926_31_auth_user_by_email.sql'));
}, 60000);

afterAll(async () => { await db?.close(); });

describe('auth_user_id_by_email', () => {
    it('finds an account by address, ignoring case and stray spaces', async () => {
        const { rows } = await asRole(db, 'service_role', null, `SELECT public.auth_user_id_by_email(' Buyer@Example.INVALID ') AS id`);
        expect(rows).toEqual([{ id: BUYER }]);
    });

    it('answers NULL for an address with no account', async () => {
        const { rows } = await asRole(db, 'service_role', null, `SELECT public.auth_user_id_by_email('nobody@example.invalid') AS id`);
        expect(rows).toEqual([{ id: null }]);
    });

    it.each([['a member', 'authenticated', BUYER], ['anyone signed out', 'anon', null]] as const)(
        'refuses %s, so it cannot be used to test which addresses have accounts',
        async (_, role, who) => {
            await expect(asRole(db, role, who, `SELECT public.auth_user_id_by_email('buyer@example.invalid')`))
                .rejects.toMatchObject({ code: '42501' });
        }
    );
});
