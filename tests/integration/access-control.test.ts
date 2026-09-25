// @vitest-environment node
/**
 * Hostile tests for the content gate, `public.check_access`, run against the
 * live schema (see tests/utils/pglite-db.ts).
 *
 * The gate is called the way the app calls it — as `authenticated`, asking
 * about the caller's own id (utils/access-control.ts, chapter-video.ts) — so
 * RLS, grants and the SECURITY DEFINER body all behave as in production.
 *
 * Each case names who is asking and what they must NOT get. The happy paths
 * are here only as controls: a deny that also denies the buyer proves nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser } from '../utils/pglite-db';

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

    await db.query(
        `INSERT INTO user_access_grants (user_id, masterclass_id, expires_at) VALUES ($1, $3, $4), ($2, $3, $5)`,
        [U.grantee, U.granteeExpired, C.publishedMasterclass, future, past]
    );
    await db.query(
        `INSERT INTO user_access_grants (user_id, chapter_id, expires_at) VALUES ($1, $2, $3)`,
        [U.chapterGrantee, C.moduleOfPublished, future]
    );
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

describe('The module/course distinction is enforced by the database, not only by a form', () => {
    // chapterSchema forces is_standalone=false when masterclass_id is set, but
    // the column defaults to TRUE and nothing in the database ties the two
    // together. Migration 17 found six such rows live. Any write path that
    // omits is_standalone — here, an admin insert through RLS, as a script or
    // SQL editor would — produces a module that the Course Pass branch treats
    // as a standalone course.
    it.fails('denies a Course Pass holder a masterclass module inserted without is_standalone', async () => {
        const admin = id(401);
        const lateModule = id(402);
        await createUser(db, admin, { role: 'admin' });
        await db.exec('BEGIN');
        try {
            await db.exec('SET LOCAL ROLE authenticated');
            await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [admin]);
            await db.query(
                `INSERT INTO chapters (id, slug, title, video_id, masterclass_id) VALUES ($1, 'late-module', 'Late module', 'v', $2)`,
                [lateModule, C.publishedMasterclass]
            );
            await db.exec('RESET ROLE');
            await db.exec('COMMIT');
        } catch (e) {
            await db.exec('ROLLBACK');
            throw e;
        }
        expect(await canAccess(U.coursePass, lateModule)).toBe(false);
    });
});

describe('The gate answers only for the caller', () => {
    // check_access is SECURITY DEFINER and EXECUTE-granted to anon, and it
    // takes the user id as an argument. Every app caller passes the session's
    // own id, but PostgREST exposes the function directly: anyone holding a
    // user's UUID (they appear in storage paths) can ask what that user bought.
    it.fails('does not tell an anonymous caller what another user owns', async () => {
        expect(await canAccess(U.grantee, C.publishedMasterclass, 'anon')).toBe(false);
    });
    it.fails('does not tell one member what another member owns', async () => {
        const result = await asRole<{ ok: boolean }>(db, 'authenticated', U.nobody,
            'SELECT public.check_access($1, $2) AS ok', [U.grantee, C.publishedMasterclass]);
        expect(result.rows[0].ok).toBe(false);
    });
});
