// @vitest-environment node
/**
 * Course progress, against the live schema.
 *
 * CompleteChapterButton used to insert `user_progress` from her browser with a
 * content id it built, and two member INSERT policies accepted any id. So a
 * member could mark any chapter mastered without answering it, and a
 * `lab_unlocked:<slug>` row for a chapter she never bought made her Essence
 * journal load that chapter's paid Lab questions. The browser also wrote
 * `courses/<slug>` for standalone courses, which no reader looks for.
 *
 * Now completeChapter and markLabUnlocked (app/actions/essence-lab.ts) decide,
 * and migration 38 takes the browser's write away.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser, readMigration } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const h = vi.hoisted(() => ({ db: null as unknown, userId: null as string | null, anonymous: false }));

vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => {
        const { pgliteSupabase: client } = await import('../utils/pglite-supabase');
        const base = client(h.db as never, 'authenticated', h.userId);
        return {
            from: (t: string) => base.from(t),
            rpc: (fn: string, args: Record<string, unknown>) => base.rpc(fn, args),
            auth: { getUser: async () => ({ data: { user: h.userId ? { id: h.userId, is_anonymous: h.anonymous } : null } }) },
        };
    },
}));
vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: () => pgliteSupabase(h.db as never, 'service_role'),
}));

import { completeChapter, markLabUnlocked } from '@/app/actions/essence-lab';

const BUYER = '00000000-0000-4000-8000-00000000e001';
const OTHER = '00000000-0000-4000-8000-00000000e002';
const GUEST = '00000000-0000-4000-8000-00000000e003';
const BOUGHT = '00000000-0000-4000-8000-00000000e101';
const NOT_BOUGHT = '00000000-0000-4000-8000-00000000e102';
const WITH_LAB = '00000000-0000-4000-8000-00000000e201';
const NO_LAB = '00000000-0000-4000-8000-00000000e202';
const UNBOUGHT_CHAPTER = '00000000-0000-4000-8000-00000000e203';
const COURSE = '00000000-0000-4000-8000-00000000e204';
const MISSING = '00000000-0000-4000-8000-00000000e2ff';

const QUESTIONS = JSON.stringify([{ key: 'q1', label: 'One', placeholder: '' }, { key: 'q2', label: 'Two', placeholder: '' }]);
let db: PGlite;

function as(userId: string | null, anonymous = false) {
    h.userId = userId;
    h.anonymous = anonymous;
}

async function progressOf(userId: string) {
    const { rows } = await db.query<{ content_id: string }>('SELECT content_id FROM user_progress WHERE user_id = $1 ORDER BY content_id', [userId]);
    return rows.map(r => r.content_id);
}

async function answer(userId: string, chapterId: string, key: string, value: unknown) {
    await db.query(
        `INSERT INTO essence_responses (user_id, chapter_id, question_key, answer_value) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (user_id, question_key, masterclass_id, chapter_id) DO UPDATE SET answer_value = EXCLUDED.answer_value`,
        [userId, chapterId, key, JSON.stringify(value)]);
}

beforeAll(async () => {
    db = await createLiveSchemaDb();
    h.db = db;
    await createUser(db, BUYER);
    await createUser(db, OTHER);
    await createUser(db, GUEST);
    await db.query(`INSERT INTO masterclasses (id, title, is_published) VALUES ($1, 'Bought', true), ($2, 'Not bought', true)`, [BOUGHT, NOT_BOUGHT]);
    await db.query(
        `INSERT INTO chapters (id, slug, title, video_id, masterclass_id, is_standalone, lab_questions) VALUES
            ($1, 'with-lab', 'With lab', 'v', $5, false, $7::jsonb),
            ($2, 'no-lab', 'No lab', 'v', $5, false, '[]'::jsonb),
            ($3, 'unbought', 'Unbought', 'v', $6, false, $7::jsonb),
            ($4, 'course-x', 'Course', 'v', NULL, true, '[]'::jsonb)`,
        [WITH_LAB, NO_LAB, UNBOUGHT_CHAPTER, COURSE, BOUGHT, NOT_BOUGHT, QUESTIONS]);
    await db.query(
        `INSERT INTO user_access_grants (user_id, masterclass_id, grant_type, expires_at) VALUES ($1, $2, 'purchase', now() + interval '1 year')`,
        [BUYER, BOUGHT]);
    await db.query(
        `INSERT INTO user_access_grants (user_id, chapter_id, grant_type, expires_at) VALUES ($1, $2, 'purchase', now() + interval '1 year')`,
        [BUYER, COURSE]);

    // What the browser left before migration 38: `courses/` rows, one with a
    // `foundations/` twin.
    await db.query(
        `INSERT INTO user_progress (user_id, content_id) VALUES ($1, 'courses/solo'), ($1, 'courses/twin'), ($1, 'foundations/twin')`, [OTHER]);
    await db.exec(readMigration('20260929_38_progress_server_only.sql'));
}, 120_000);

afterAll(async () => { await db?.close(); });

describe('Mastering a chapter', () => {
    it('is refused while a question is unanswered, and blank counts as unanswered', async () => {
        as(BUYER);
        await answer(BUYER, WITH_LAB, 'q1', 'my answer');
        await answer(BUYER, WITH_LAB, 'q2', '   ');
        expect(await completeChapter({ chapterId: WITH_LAB })).toEqual({ success: true, mastered: false });
        expect(await progressOf(BUYER)).not.toContain('foundations/with-lab');
    });

    it('is recorded once every question is answered, as foundations/<slug>', async () => {
        as(BUYER);
        await answer(BUYER, WITH_LAB, 'q2', ['a', 'b']);
        expect(await completeChapter({ chapterId: WITH_LAB })).toEqual({ success: true, mastered: true });
        expect(await completeChapter({ chapterId: WITH_LAB })).toEqual({ success: true, mastered: true });
        expect((await progressOf(BUYER)).filter(id => id === 'foundations/with-lab')).toHaveLength(1);
    });

    it('does not count answers to questions the chapter does not ask', async () => {
        as(OTHER);
        await db.query(`INSERT INTO user_access_grants (user_id, masterclass_id, grant_type) VALUES ($1, $2, 'purchase')`, [OTHER, BOUGHT]);
        await answer(OTHER, WITH_LAB, 'q1', 'yes');
        await answer(OTHER, WITH_LAB, 'stale-key', 'yes');
        expect(await completeChapter({ chapterId: WITH_LAB })).toEqual({ success: true, mastered: false });
    });

    it('needs no answers for a chapter without questions', async () => {
        as(BUYER);
        expect(await completeChapter({ chapterId: NO_LAB })).toEqual({ success: true, mastered: true });
        expect(await progressOf(BUYER)).toContain('foundations/no-lab');
    });

    it('records a standalone course where the course pages read it', async () => {
        as(BUYER);
        expect(await completeChapter({ chapterId: COURSE })).toEqual({ success: true, mastered: true });
        expect(await progressOf(BUYER)).toContain('foundations/course-x');
        expect(await progressOf(BUYER)).not.toContain('courses/course-x');
    });

    it('is refused for a chapter she has not bought, answered or not', async () => {
        as(BUYER);
        await answer(BUYER, UNBOUGHT_CHAPTER, 'q1', 'a');
        await answer(BUYER, UNBOUGHT_CHAPTER, 'q2', 'b');
        expect(await completeChapter({ chapterId: UNBOUGHT_CHAPTER })).toEqual({ success: false, error: 'Forbidden' });
        expect(await progressOf(BUYER)).not.toContain('foundations/unbought');
    });

    it('gives the same answer for a chapter that does not exist', async () => {
        as(BUYER);
        expect(await completeChapter({ chapterId: MISSING })).toEqual({ success: false, error: 'Forbidden' });
    });

    it('is refused signed out, and to an anonymous guest', async () => {
        as(null);
        expect(await completeChapter({ chapterId: NO_LAB })).toMatchObject({ success: false });
        as(GUEST, true);
        await db.query(`INSERT INTO user_access_grants (user_id, masterclass_id, grant_type) VALUES ($1, $2, 'purchase')`, [GUEST, BOUGHT]);
        expect(await completeChapter({ chapterId: NO_LAB })).toMatchObject({ success: false });
        expect(await progressOf(GUEST)).toEqual([]);
    });

    it('writes only her own row for the chapter, whatever else is sent', async () => {
        as(BUYER);
        const before = await progressOf(OTHER);
        const hostile = { chapterId: NO_LAB, user_id: OTHER, content_id: 'foundations/unbought' };
        expect(await completeChapter(hostile as never)).toEqual({ success: true, mastered: true });
        expect(await progressOf(OTHER)).toEqual(before);
        expect(await progressOf(BUYER)).not.toContain('foundations/unbought');
    });

    it('rejects a chapter id that is not a uuid', async () => {
        as(BUYER);
        expect(await completeChapter({ chapterId: "' OR 1=1 --" })).toMatchObject({ success: false });
    });
});

describe('Unlocking a chapter\'s Lab', () => {
    it('is recorded for a chapter she has bought', async () => {
        as(BUYER);
        expect(await markLabUnlocked('with-lab')).toEqual({ success: true });
        expect(await markLabUnlocked('with-lab')).toEqual({ success: true });
        expect((await progressOf(BUYER)).filter(id => id === 'lab_unlocked:with-lab')).toHaveLength(1);
    });

    // The unlock is what lets her journal load a chapter's paid questions.
    it('is refused for a chapter she has not bought', async () => {
        as(BUYER);
        expect(await markLabUnlocked('unbought')).toEqual({ success: false, error: 'Forbidden' });
        expect(await progressOf(BUYER)).not.toContain('lab_unlocked:unbought');
    });

    it('is refused to an anonymous guest and for an unknown slug', async () => {
        as(GUEST, true);
        expect(await markLabUnlocked('with-lab')).toMatchObject({ success: false });
        as(BUYER);
        expect(await markLabUnlocked('no-such-chapter')).toEqual({ success: false, error: 'Forbidden' });
        expect(await markLabUnlocked('')).toMatchObject({ success: false });
    });
});

describe('Her browser cannot write progress (migration 38)', () => {
    it.each([
        ['a chapter she has not bought', 'foundations/unbought'],
        ['a Lab she has not bought', 'lab_unlocked:unbought'],
    ])('refuses her direct insert for %s', async (_, contentId) => {
        await expect(asRole(db, 'authenticated', BUYER,
            'INSERT INTO user_progress (user_id, content_id) VALUES ($1, $2)', [BUYER, contentId]))
            .rejects.toMatchObject({ code: '42501' });
    });

    it('refuses her update and delete of her own rows', async () => {
        await expect(asRole(db, 'authenticated', BUYER, `UPDATE user_progress SET content_id = 'foundations/unbought' WHERE user_id = $1`, [BUYER]))
            .rejects.toMatchObject({ code: '42501' });
        await expect(asRole(db, 'authenticated', BUYER, 'DELETE FROM user_progress WHERE user_id = $1', [BUYER]))
            .rejects.toMatchObject({ code: '42501' });
    });

    it('still lets her read her own progress, and only hers', async () => {
        const { rows } = await asRole<{ user_id: string }>(db, 'authenticated', BUYER, 'SELECT user_id FROM user_progress');
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(r => r.user_id === BUYER)).toBe(true);
    });

    it('moved the courses/ rows to where the course pages read them', async () => {
        const ids = await progressOf(OTHER);
        expect(ids.filter(id => id.startsWith('courses/'))).toEqual([]);
        expect(ids.filter(id => id === 'foundations/solo' || id === 'foundations/twin')).toEqual(['foundations/solo', 'foundations/twin']);
    });

    it('dropped the single term line-item columns', async () => {
        const { rows } = await db.query(
            `SELECT column_name FROM information_schema.columns WHERE column_name IN ('access_term_line_item', 'term_line_item')`);
        expect(rows).toEqual([]);
    });
});
