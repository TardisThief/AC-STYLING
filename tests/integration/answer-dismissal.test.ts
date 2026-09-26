// @vitest-environment node
/**
 * Dismissing an answered question, against the live schema.
 *
 * markAnswerAsRead updated `user_questions` through the member's own session.
 * There is no member UPDATE policy on that table, so RLS matched no rows,
 * Postgres reported no error, and the action answered success. The answer
 * came back on every visit (2026-09-25 external assessment, UX-001).
 *
 * A member UPDATE policy is not the fix: RLS cannot limit columns, and the
 * table grants UPDATE on all of them, so it would also let her rewrite her
 * question or the stylist's answer. The status change goes through the
 * service role after an ownership check, as the Studio client edits do.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLiveSchemaDb, createUser } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MEMBER = id(1);
const OTHER = id(2);
const HERS = id(201);
const THEIRS = id(202);

const { state } = vi.hoisted(() => ({ state: { db: null as PGlite | null, user: null as string | null } }));

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => pgliteSupabase(state.db!) }));
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: state.user ? { id: state.user } : null } }) },
        from: (table: string) => pgliteSupabase(state.db!, 'authenticated', state.user).from(table),
    }),
}));

import { markAnswerAsRead } from '@/app/actions/send-question';

async function status(questionId: string) {
    const { rows } = await state.db!.query<{ status: string }>('SELECT status FROM user_questions WHERE id = $1', [questionId]);
    return rows[0]?.status;
}

beforeAll(async () => {
    const db = await createLiveSchemaDb();
    state.db = db;
    await createUser(db, MEMBER);
    await createUser(db, OTHER);
    await db.query(
        `INSERT INTO user_questions (id, user_id, question, answer, status) VALUES
            ($1, $2, 'Which colours suit me?', 'Warm autumn tones.', 'answered'),
            ($3, $4, 'Their question', 'Their answer', 'answered')`,
        [HERS, MEMBER, THEIRS, OTHER]);
}, 60000);

afterAll(async () => { await state.db?.close(); });

describe('markAnswerAsRead', () => {
    it('actually marks her answered question as read', async () => {
        state.user = MEMBER;

        const result = await markAnswerAsRead(HERS);

        expect(result).toEqual({ success: true });
        expect(await status(HERS)).toBe('read');
    });

    it('does not touch someone else’s question, and says so', async () => {
        state.user = MEMBER;

        const result = await markAnswerAsRead(THEIRS);

        expect(result.success).toBe(false);
        expect(await status(THEIRS)).toBe('answered');
    });

    it('refuses a signed-out caller', async () => {
        state.user = null;

        expect((await markAnswerAsRead(HERS)).success).toBe(false);
    });
});
