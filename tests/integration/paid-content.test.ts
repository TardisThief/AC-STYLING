// @vitest-environment node
/**
 * Paid course material stays paid, against the live schema (2026-09-25
 * external assessment, MEDIA-001; owner decision 2026-09-26: paid-only).
 *
 * Migration 09 hid chapter video ids from browser roles but deliberately left
 * `lab_questions` and `resource_urls` readable, and masterclasses carried a
 * plain table-level SELECT, so `resource_urls` there was public too. Anyone —
 * signed out included — could list every Essence Lab question and every
 * downloadable link, for content they had not bought and content not yet
 * published, straight from PostgREST. The pages only hid them.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser } from '../utils/pglite-db';

const MEMBER = '00000000-0000-4000-8000-00000000e001';
let db: PGlite;

beforeAll(async () => {
    db = await createLiveSchemaDb();
    await createUser(db, MEMBER);
    await db.query(`INSERT INTO masterclasses (title, resource_urls, is_published) VALUES ('Draft', '[{"name":"Workbook","url":"https://files.invalid/workbook.pdf"}]', false)`);
    await db.query(`INSERT INTO chapters (slug, title, video_id, lab_questions, resource_urls) VALUES ('m1', 'Module', 'pending_video', '[{"key":"q1","label":"Paid question"}]', '[{"name":"Sheet","url":"https://files.invalid/sheet.pdf"}]')`);
}, 60000);

afterAll(async () => { await db?.close(); });

describe.each([['anyone signed out', 'anon', null], ['a member who bought nothing', 'authenticated', MEMBER]] as const)(
    '%s', (_, role, who) => {
        it.fails('cannot read the Essence Lab questions', async () => {
            await expect(asRole(db, role, who, 'SELECT lab_questions FROM chapters')).rejects.toMatchObject({ code: '42501' });
        });

        it.fails('cannot read chapter downloads', async () => {
            await expect(asRole(db, role, who, 'SELECT resource_urls FROM chapters')).rejects.toMatchObject({ code: '42501' });
        });

        it.fails('cannot read masterclass downloads', async () => {
            await expect(asRole(db, role, who, 'SELECT resource_urls FROM masterclasses')).rejects.toMatchObject({ code: '42501' });
        });

        it('still reads the catalogue itself', async () => {
            const mc = await asRole(db, role, who, 'SELECT title, is_published FROM masterclasses');
            expect(mc.rows).toEqual([{ title: 'Draft', is_published: false }]);
            const ch = await asRole(db, role, who, 'SELECT slug, title FROM chapters');
            expect(ch.rows).toEqual([{ slug: 'm1', title: 'Module' }]);
        });
    }
);
