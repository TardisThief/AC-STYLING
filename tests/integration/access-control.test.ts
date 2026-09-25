// @vitest-environment node
/**
 * Hostile tests for the content gate, `public.check_access`, run against the
 * live schema (see tests/utils/pglite-db.ts).
 *
 * The gate is called the way the app calls it — as `authenticated`, asking
 * about the caller's own id (utils/access-control.ts, chapter-video.ts) — so
 * RLS, grants and the SECURITY DEFINER body all behave as in production.
 *
 * Two holes were found here and closed by migration 22. As in
 * authorization.test.ts, beforeAll proves both reproduce against the live
 * schema BEFORE applying the migration, so the tests below are known to be
 * testing the migration and not an accident of the fixture.
 *
 * Each case names who is asking and what they must NOT get. The happy paths
 * are here only as controls: a deny that also denies the buyer proves nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser, readMigration } from '../utils/pglite-db';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const U = {
    nobody: id(1),
    masterclassPass: id(2),
    coursePass: id(3),
    fullUnlock: id(4),
    fullUnlockExpired: id(5),
    legacyPerpetual: id(6),
    adminExpired: id(7),
    grantee: id(8),
    granteeExpired: id(9),
    masterclassPassExpired: id(10),
    coursePassExpired: id(11),
    chapterGrantee: id(12),
};

const C = {
    publishedMasterclass: id(101),
    unpublishedMasterclass: id(102),
    moduleOfPublished: id(201),
    secondModuleOfPublished: id(202),
    moduleOfUnpublished: id(203),
    standaloneCourse: id(204),
    orphanChapter: id(205),
    // A module written without is_standalone, which then defaults to TRUE.
    misflaggedModule: id(206),
};

const past = '2020-01-01T00:00:00Z';
const future = '2999-01-01T00:00:00Z';
let db: PGlite;

async function canAccess(userId: string | null, objectId: string, role: 'authenticated' | 'anon' = 'authenticated') {
    const result = await asRole<{ ok: boolean }>(db, role, userId, 'SELECT public.check_access($1, $2) AS ok', [userId, objectId]);
    return result.rows[0].ok;
}

beforeAll(async () => {
    db = await createLiveSchemaDb();

    await db.query(
        `INSERT INTO masterclasses (id, title, is_published) VALUES ($1, 'Published', true), ($2, 'Unpublished', false)`,
        [C.publishedMasterclass, C.unpublishedMasterclass]
    );
    // Written the way the admin form writes them (chapterSchema forces
    // is_standalone=false whenever masterclass_id is set).
    await db.query(
        `INSERT INTO chapters (id, slug, title, video_id, masterclass_id, is_standalone, is_published) VALUES
            ($1, 'm1', 'Module 1', 'v', $5, false, true),
            ($2, 'm2', 'Module 2', 'v', $5, false, true),
            ($3, 'm3', 'Unpublished module', 'v', $6, false, false),
            ($4, 'course', 'Standalone course', 'v', NULL, true, true),
            ($7, 'orphan', 'Neither', 'v', NULL, false, true)`,
        [C.moduleOfPublished, C.secondModuleOfPublished, C.moduleOfUnpublished, C.standaloneCourse, C.publishedMasterclass, C.unpublishedMasterclass, C.orphanChapter]
    );

    await createUser(db, U.nobody);
    await createUser(db, U.masterclassPass, { has_masterclass_pass: true, access_expires_at: future });
    await createUser(db, U.masterclassPassExpired, { has_masterclass_pass: true, access_expires_at: past });
    await createUser(db, U.coursePass, { has_course_pass: true, access_expires_at: future });
    await createUser(db, U.coursePassExpired, { has_course_pass: true, access_expires_at: past });
    await createUser(db, U.fullUnlock, { has_full_unlock: true, access_expires_at: future });
    await createUser(db, U.fullUnlockExpired, { has_full_unlock: true, access_expires_at: past });
    await createUser(db, U.legacyPerpetual, { has_full_unlock: true, access_expires_at: null });
    await createUser(db, U.adminExpired, { role: 'admin', access_expires_at: past });
    await createUser(db, U.grantee);
    await createUser(db, U.granteeExpired);
    await createUser(db, U.chapterGrantee);
    const admin = id(401);
    await createUser(db, admin, { role: 'admin' });

    await db.query(
        `INSERT INTO user_access_grants (user_id, masterclass_id, expires_at) VALUES ($1, $3, $4), ($2, $3, $5)`,
        [U.grantee, U.granteeExpired, C.publishedMasterclass, future, past]
    );
    await db.query(
        `INSERT INTO user_access_grants (user_id, chapter_id, expires_at) VALUES ($1, $2, $3)`,
        [U.chapterGrantee, C.moduleOfPublished, future]
    );

    // An admin adds a module through RLS the way a script or the SQL editor
    // would, leaving is_standalone to its default. chapterSchema would have
    // forced it false; nothing in the database does.
    await db.exec('BEGIN');
    await db.exec('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [admin]);
    await db.query("SELECT set_config('request.jwt.claim.role', 'authenticated', true)");
    await db.query(
        `INSERT INTO chapters (id, slug, title, video_id, masterclass_id) VALUES ($1, 'late-module', 'Late module', 'v', $2)`,
        [C.misflaggedModule, C.publishedMasterclass]
    );
    await db.exec('COMMIT');

    // Both holes reproduce on the live schema before migration 22.
    expect(await canAccess(U.coursePass, C.misflaggedModule)).toBe(true);
    expect((await asRole<{ ok: boolean }>(db, 'anon', null,
        'SELECT public.check_access($1, $2) AS ok', [U.grantee, C.publishedMasterclass])).rows[0].ok).toBe(true);

    await db.exec(readMigration('20260925_22_check_access_boundaries.sql'));

    // Before migration 25: get_user_role tells an anonymous caller who the admin is.
    expect((await asRole<{ role: string }>(db, 'anon', null, 'SELECT public.get_user_role($1) AS role', [U.adminExpired])).rows[0].role).toBe('admin');
    await db.exec(readMigration('20260925_25_get_user_role_caller_only.sql'));
}, 60000);

afterAll(async () => { await db?.close(); });

describe('Masterclass Pass does not reach standalone courses', () => {
    it('opens every masterclass and its modules (control)', async () => {
        expect(await canAccess(U.masterclassPass, C.publishedMasterclass)).toBe(true);
        expect(await canAccess(U.masterclassPass, C.moduleOfPublished)).toBe(true);
    });
    it('is denied a standalone course', async () => {
        expect(await canAccess(U.masterclassPass, C.standaloneCourse)).toBe(false);
    });
    it('is denied a chapter that belongs to no masterclass and is not a course', async () => {
        expect(await canAccess(U.masterclassPass, C.orphanChapter)).toBe(false);
    });
});

describe('Course Pass does not reach masterclasses', () => {
    it('opens a standalone course (control)', async () => {
        expect(await canAccess(U.coursePass, C.standaloneCourse)).toBe(true);
    });
    it('is denied a masterclass and its modules', async () => {
        expect(await canAccess(U.coursePass, C.publishedMasterclass)).toBe(false);
        expect(await canAccess(U.coursePass, C.moduleOfPublished)).toBe(false);
    });
});

describe('The one-year term is enforced by the gate itself', () => {
    it.each([
        ['full unlock', U.fullUnlockExpired, C.moduleOfPublished],
        ['masterclass pass', U.masterclassPassExpired, C.moduleOfPublished],
        ['course pass', U.coursePassExpired, C.standaloneCourse],
    ])('denies an expired %s', async (_label, user, object) => {
        expect(await canAccess(user, object)).toBe(false);
    });
    it('keeps a live full unlock open (control)', async () => {
        expect(await canAccess(U.fullUnlock, C.standaloneCourse)).toBe(true);
    });
    it('keeps a pre-term buyer (NULL expiry) perpetual', async () => {
        expect(await canAccess(U.legacyPerpetual, C.moduleOfPublished)).toBe(true);
    });
    it('does not subject an admin to the term', async () => {
        expect(await canAccess(U.adminExpired, C.moduleOfPublished)).toBe(true);
    });
});

describe('Direct grants', () => {
    it('a masterclass grant opens that masterclass and its modules (control)', async () => {
        expect(await canAccess(U.grantee, C.publishedMasterclass)).toBe(true);
        expect(await canAccess(U.grantee, C.secondModuleOfPublished)).toBe(true);
    });
    it('a masterclass grant does not leak to another masterclass, a course, or an orphan', async () => {
        expect(await canAccess(U.grantee, C.unpublishedMasterclass)).toBe(false);
        expect(await canAccess(U.grantee, C.moduleOfUnpublished)).toBe(false);
        expect(await canAccess(U.grantee, C.standaloneCourse)).toBe(false);
        expect(await canAccess(U.grantee, C.orphanChapter)).toBe(false);
    });
    it('a single-module grant does not open the parent masterclass or its sibling modules', async () => {
        expect(await canAccess(U.chapterGrantee, C.moduleOfPublished)).toBe(true);
        expect(await canAccess(U.chapterGrantee, C.publishedMasterclass)).toBe(false);
        expect(await canAccess(U.chapterGrantee, C.secondModuleOfPublished)).toBe(false);
    });
    it('an expired masterclass grant closes the masterclass AND the inherited modules', async () => {
        expect(await canAccess(U.granteeExpired, C.publishedMasterclass)).toBe(false);
        expect(await canAccess(U.granteeExpired, C.moduleOfPublished)).toBe(false);
    });
    it('a grant for content that was deleted and re-created under the same id does not survive', async () => {
        const doomed = id(301);
        const buyer = id(302);
        await createUser(db, buyer);
        await db.query(`INSERT INTO masterclasses (id, title) VALUES ($1, 'Doomed')`, [doomed]);
        await db.query(`INSERT INTO user_access_grants (user_id, masterclass_id) VALUES ($1, $2)`, [buyer, doomed]);
        expect(await canAccess(buyer, doomed)).toBe(true);

        await db.query('DELETE FROM masterclasses WHERE id = $1', [doomed]);
        await db.query(`INSERT INTO masterclasses (id, title) VALUES ($1, 'Different product, reused id')`, [doomed]);
        expect(await canAccess(buyer, doomed)).toBe(false);
    });
});

describe('Nobody grants themselves an entitlement', () => {
    it('denies the unentitled user everything (control for every allow above)', async () => {
        for (const object of Object.values(C)) {
            expect(await canAccess(U.nobody, object)).toBe(false);
        }
    });
    it.each(['has_full_unlock', 'has_course_pass', 'has_masterclass_pass', 'access_expires_at', 'access_renewal_count', 'role'])(
        'denies a member writing profiles.%s on their own row',
        async column => {
            await expect(
                asRole(db, 'authenticated', U.nobody, `UPDATE profiles SET ${column} = ${column} WHERE id = $1`, [U.nobody])
            ).rejects.toMatchObject({ code: '42501' });
        }
    );
    it('denies a member inserting their own grant row', async () => {
        const result = asRole(db, 'authenticated', U.nobody,
            'INSERT INTO user_access_grants (user_id, masterclass_id) VALUES ($1, $2) RETURNING id',
            [U.nobody, C.publishedMasterclass]);
        await expect(result).rejects.toMatchObject({ code: '42501' });
    });
    it('denies a member extending their own grant', async () => {
        const result = await asRole(db, 'authenticated', U.granteeExpired,
            `UPDATE user_access_grants SET expires_at = $2 WHERE user_id = $1 RETURNING id`,
            [U.granteeExpired, future]);
        expect(result.rows).toEqual([]);
    });
});

describe('The module/course distinction is enforced by the gate, not only by a form', () => {
    it('denies a Course Pass holder a masterclass module left flagged standalone', async () => {
        expect(await canAccess(U.coursePass, C.misflaggedModule)).toBe(false);
    });
    it('still opens that module to the Masterclass Pass it belongs to (control)', async () => {
        expect(await canAccess(U.masterclassPass, C.misflaggedModule)).toBe(true);
    });
});

describe('The gate answers only for the caller', () => {
    it('refuses to run for an anonymous caller at all', async () => {
        await expect(asRole(db, 'anon', null, 'SELECT public.check_access($1, $2) AS ok', [U.grantee, C.publishedMasterclass]))
            .rejects.toMatchObject({ code: '42501' });
    });
    it('does not tell one member what another member owns', async () => {
        const result = await asRole<{ ok: boolean }>(db, 'authenticated', U.nobody,
            'SELECT public.check_access($1, $2) AS ok', [U.grantee, C.publishedMasterclass]);
        expect(result.rows[0].ok).toBe(false);
    });
    it('does not let a member borrow an admin’s answer', async () => {
        const result = await asRole<{ ok: boolean }>(db, 'authenticated', U.nobody,
            'SELECT public.check_access($1, $2) AS ok', [U.adminExpired, C.publishedMasterclass]);
        expect(result.rows[0].ok).toBe(false);
    });
    it('still answers the server, which asks on a user’s behalf (control)', async () => {
        const result = await asRole<{ ok: boolean }>(db, 'service_role', null,
            'SELECT public.check_access($1, $2) AS ok', [U.grantee, C.publishedMasterclass]);
        expect(result.rows[0].ok).toBe(true);
    });
});

describe('Other SECURITY DEFINER functions that take someone else’s id', () => {
    // Same shape as check_access: they run as the owner and take the target
    // as an argument. clone_* copies any item, internal_note included, into
    // any profile. authorization.test.ts pins anon; a signed-in member is the
    // caller that actually has a session to try it with.
    it.each(['clone_wardrobe_item', 'clone_lookbook'])('denies a signed-in member %s', async fn => {
        await expect(asRole(db, 'authenticated', U.nobody, `SELECT public.${fn}($1, $2)`, [id(999), U.nobody]))
            .rejects.toMatchObject({ code: '42501' });
    });
});

describe('get_user_role answers only for the caller (migration 25)', () => {
    it('still answers the server (control)', async () => {
        const { rows } = await asRole<{ role: string | null }>(db, 'service_role', null, 'SELECT public.get_user_role($1) AS role', [U.adminExpired]);
        expect(rows[0].role).toBe('admin');
    });
    // SECURITY DEFINER, EXECUTE-granted to anon, and it takes the user id as
    // an argument: anyone holding a UUID could ask whether it is the admin's.
    it('does not tell an anonymous caller who is an admin', async () => {
        const { rows } = await asRole<{ role: string | null }>(db, 'anon', null, 'SELECT public.get_user_role($1) AS role', [U.adminExpired]);
        expect(rows[0].role).toBeNull();
    });
    it('does not tell a member who is an admin', async () => {
        const { rows } = await asRole<{ role: string | null }>(db, 'authenticated', U.nobody, 'SELECT public.get_user_role($1) AS role', [U.adminExpired]);
        expect(rows[0].role).toBeNull();
    });
    it('still answers a member about herself (control)', async () => {
        const { rows } = await asRole<{ role: string | null }>(db, 'authenticated', U.nobody, 'SELECT public.get_user_role($1) AS role', [U.nobody]);
        expect(rows[0].role).toBe('user');
    });
    it('still lets the profiles policy that uses it show an admin every profile (control)', async () => {
        const { rows } = await asRole(db, 'authenticated', U.adminExpired, 'SELECT id FROM profiles WHERE id = $1', [U.nobody]);
        expect(rows).toHaveLength(1);
        const hidden = await asRole(db, 'authenticated', U.nobody, 'SELECT id FROM profiles WHERE id = $1', [U.adminExpired]);
        expect(hidden.rows).toHaveLength(0);
    });
});
