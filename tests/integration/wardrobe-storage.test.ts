// @vitest-environment node
/**
 * The Studio wardrobe boundary, attacked in real PostgreSQL.
 *
 * Two layers decide who can see a client's clothes: the `studio-wardrobe`
 * bucket policy (public.can_access_wardrobe_object, from migration 07) and
 * RLS on wardrobes / wardrobe_items. Both are loaded from the live schema; the
 * storage policies live outside the public-schema dump, so migration 07's
 * own file is applied for them.
 *
 * The folder convention is where confusion lives: `<ownerId>/…` for owned
 * content, `wardrobe/<id>/…` for intake — where <id> may be a USER id (invite
 * profile) or a WARDROBE id (token intake). One path segment, two namespaces.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser, readMigration } from '../utils/pglite-db';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = id(1);          // client with a wardrobe
const B = id(2);          // another client with a wardrobe
const NOBODY = id(3);     // signed in, no wardrobe
const ADMIN = id(4);
const WA = id(101);       // A's wardrobe
const WB = id(102);       // B's wardrobe
const WG = id(103);       // ownerless guest-intake wardrobe

let db: PGlite;

async function canRead(user: string | null, name: string) {
    const role = user ? 'authenticated' : 'anon';
    const { rows } = await asRole(db, role, user, `SELECT 1 FROM storage.objects WHERE bucket_id = 'studio-wardrobe' AND name = $1`, [name]);
    return rows.length === 1;
}

async function canUpload(user: string, name: string) {
    try {
        await asRole(db, 'authenticated', user, `INSERT INTO storage.objects (bucket_id, name) VALUES ('studio-wardrobe', $1)`, [name]);
        return true;
    } catch (e) {
        if ((e as { code?: string }).code === '42501') return false;
        throw e;
    }
}

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await db.exec(readMigration('20260711_07_owner_scope_studio_wardrobe.sql'));

    await createUser(db, A);
    await createUser(db, B);
    await createUser(db, NOBODY);
    await createUser(db, ADMIN, { role: 'admin' });
    await db.query(`INSERT INTO wardrobes (id, owner_id) VALUES ($1, $3), ($2, $4), ($5, NULL)`, [WA, WB, A, B, WG]);
    for (const name of [`${A}/a.jpg`, `${B}/b.jpg`, `wardrobe/${WA}/a.jpg`, `wardrobe/${WB}/b.jpg`, `wardrobe/${WG}/g.jpg`, `wardrobe/${B}/invite.jpg`]) {
        await db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('studio-wardrobe', $1)`, [name]);
    }
}, 120_000);

afterAll(async () => { await db?.close(); });

describe('Reading the bucket', () => {
    it('lets a client read her own folder and her own wardrobe’s intake (control)', async () => {
        expect(await canRead(A, `${A}/a.jpg`)).toBe(true);
        expect(await canRead(A, `wardrobe/${WA}/a.jpg`)).toBe(true);
    });
    it.each([
        ['another client’s folder', `${B}/b.jpg`],
        ['another client’s wardrobe intake', `wardrobe/${WB}/b.jpg`],
        ['an ownerless guest intake', `wardrobe/${WG}/g.jpg`],
        ['another client’s invite-profile intake', `wardrobe/${B}/invite.jpg`],
    ])('denies a client %s', async (_label, name) => {
        expect(await canRead(A, name)).toBe(false);
    });
    it('shows a signed-in stranger and an anonymous visitor nothing', async () => {
        for (const name of [`${A}/a.jpg`, `wardrobe/${WA}/a.jpg`, `wardrobe/${WG}/g.jpg`]) {
            expect(await canRead(NOBODY, name)).toBe(false);
            expect(await canRead(null, name)).toBe(false);
        }
    });
    it('lets the stylist read everything (control)', async () => {
        expect(await canRead(ADMIN, `wardrobe/${WG}/g.jpg`)).toBe(true);
        expect(await canRead(ADMIN, `${B}/b.jpg`)).toBe(true);
    });
    it('moves wardrobe-intake access with the wardrobe when it is reassigned', async () => {
        await db.query('UPDATE wardrobes SET owner_id = $1 WHERE id = $2', [B, WA]);
        try {
            expect(await canRead(A, `wardrobe/${WA}/a.jpg`)).toBe(false);
            expect(await canRead(B, `wardrobe/${WA}/a.jpg`)).toBe(true);
        } finally {
            await db.query('UPDATE wardrobes SET owner_id = $1 WHERE id = $2', [A, WA]);
        }
    });
});

describe('Writing to the bucket', () => {
    it('lets a client upload into her own folder (control)', async () => {
        expect(await canUpload(A, `${A}/new.jpg`)).toBe(true);
    });
    it.each([
        ['another client’s folder', `${B}/planted.jpg`],
        ['another client’s wardrobe intake', `wardrobe/${WB}/planted.jpg`],
        ['an ownerless guest intake', `wardrobe/${WG}/planted.jpg`],
        ['another client’s invite-profile intake', `wardrobe/${B}/planted.jpg`],
        ['the bucket root', 'planted.jpg'],
        ['an empty folder segment', `wardrobe//planted.jpg`],
        ['a bare "wardrobe" folder', 'wardrobe/planted.jpg'],
    ])('denies a client uploading into %s', async (_label, name) => {
        expect(await canUpload(A, name)).toBe(false);
    });
    it('keeps a traversal-looking name inside the uploader’s own namespace', async () => {
        // Object names are keys, not paths: "A/../B/x" is a key under A/, and
        // the policy reads its first segment as A. It must never be readable
        // as B's.
        const name = `${A}/../${B}/x.jpg`;
        expect(await canUpload(A, name)).toBe(true);
        await db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('studio-wardrobe', $1)`, [name]);
        expect(await canRead(B, name)).toBe(false);
    });
    it('denies an anonymous upload anywhere', async () => {
        await expect(asRole(db, 'anon', null, `INSERT INTO storage.objects (bucket_id, name) VALUES ('studio-wardrobe', $1)`, [`wardrobe/${WG}/x.jpg`]))
            .rejects.toMatchObject({ code: '42501' });
    });
});

describe('Wardrobe rows', () => {
    // A wardrobe whose id equalled another user's id would make
    // `wardrobe/<that user>/…` match "a wardrobe I own".
    it('denies a member creating a wardrobe, so she cannot mint one with a chosen id', async () => {
        await expect(asRole(db, 'authenticated', A, 'INSERT INTO wardrobes (id, owner_id) VALUES ($1, $2)', [B, A]))
            .rejects.toMatchObject({ code: '42501' });
    });
    it('denies a member re-pointing or re-owning a wardrobe', async () => {
        const moved = await asRole(db, 'authenticated', A, 'UPDATE wardrobes SET id = $1 WHERE id = $2 RETURNING id', [B, WA]);
        expect(moved.rows).toEqual([]);
        const taken = await asRole(db, 'authenticated', A, 'UPDATE wardrobes SET owner_id = $1 WHERE id = $2 RETURNING id', [A, WB]);
        expect(taken.rows).toEqual([]);
    });
    it('does not show a member another client’s wardrobe or items', async () => {
        await db.query(`INSERT INTO wardrobe_items (wardrobe_id, user_id, image_url) VALUES ($1, $2, 'x')`, [WB, B]);
        expect((await asRole(db, 'authenticated', A, 'SELECT id FROM wardrobes WHERE id = $1', [WB])).rows).toEqual([]);
        expect((await asRole(db, 'authenticated', A, 'SELECT id FROM wardrobe_items WHERE wardrobe_id = $1', [WB])).rows).toEqual([]);
    });

    // "Users can insert own wardrobe items during intake" checks user_id and
    // nothing else, and the victim's own SELECT policy shows her every item
    // whose wardrobe_id is one of hers.
    it.fails('denies a member planting an item in another client’s wardrobe', async () => {
        await expect(asRole(db, 'authenticated', A,
            `INSERT INTO wardrobe_items (wardrobe_id, user_id, image_url, client_note) VALUES ($1, $2, 'https://attacker.invalid/x.jpg', 'planted') RETURNING id`,
            [WB, A])).rejects.toMatchObject({ code: '42501' });
    });
});
