// @vitest-environment node
/**
 * Who may touch the stylist's notification inbox, against the live schema.
 *
 * The only policy on admin_notifications granted full access to one
 * hardcoded user id. Checked 2026-09-26, that id is neither of the two admin
 * accounts — the account it named is gone — so the policy granted everything
 * to an identity that no longer exists and nothing to the admins who do.
 * The app reads the inbox through the service role after requireAdmin(), so
 * nothing broke; but an access rule should name a role, not a person.
 * Notifications carry buyers' names, emails and phone numbers.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser } from '../utils/pglite-db';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ADMIN = id(1);
const MEMBER = id(2);
const GONE = '4613bce4-5a40-4779-9e87-0def946be940';

let db: PGlite;

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await createUser(db, ADMIN, { role: 'admin' });
    await createUser(db, MEMBER);
    await db.query(`INSERT INTO admin_notifications (type, title, metadata) VALUES ('sale', 'New Sale', '{"email":"buyer@example.invalid","phone":"+10000000000"}')`);
}, 60000);

afterAll(async () => { await db?.close(); });

describe('admin_notifications', () => {
    it.fails('lets an admin read the inbox directly', async () => {
        const { rows } = await asRole(db, 'authenticated', ADMIN, 'SELECT title FROM admin_notifications');
        expect(rows).toEqual([{ title: 'New Sale' }]);
    });

    it.fails('does not grant anything to the hardcoded id of an account that no longer exists', async () => {
        const { rows } = await asRole(db, 'authenticated', GONE, 'SELECT title FROM admin_notifications');
        expect(rows).toEqual([]);
    });

    it.each([['a member', MEMBER], ['anyone signed out', null]] as const)('shows %s nothing', async (_, who) => {
        const { rows } = await asRole(db, who ? 'authenticated' : 'anon', who, 'SELECT title FROM admin_notifications');
        expect(rows).toEqual([]);
    });

    it('does not let a member plant a notification', async () => {
        await expect(asRole(db, 'authenticated', MEMBER,
            `INSERT INTO admin_notifications (type, title) VALUES ('sale', 'Fake')`)).rejects.toMatchObject({ code: '42501' });
    });
});
