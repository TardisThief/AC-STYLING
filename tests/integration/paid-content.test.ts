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
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createLiveSchemaDb, createUser, expectMigrationApplied } from '../utils/pglite-db';
import { pgliteSupabase } from '../utils/pglite-supabase';

const MEMBER = '00000000-0000-4000-8000-00000000e001';
const MC = '00000000-0000-4000-8000-00000000e101';
const CH = '00000000-0000-4000-8000-00000000e201';

const { state, signed } = vi.hoisted(() => ({
    state: { db: null as PGlite | null },
    signed: [] as { bucket: string; path: string; seconds: number }[],
}));

vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: () => {
        const client = pgliteSupabase(state.db!);
        return {
            from: client.from.bind(client),
            storage: {
                from: (bucket: string) => ({
                    createSignedUrl: async (path: string, seconds: number) => {
                        signed.push({ bucket, path, seconds });
                        return path === 'missing.pdf'
                            ? { data: null, error: { message: 'Object not found' } }
                            : { data: { signedUrl: `https://storage.invalid/sign/${bucket}/${path}?token=t` }, error: null };
                    },
                }),
            },
        };
    },
}));

import { loadChapterPaidContent, loadLabQuestionsFor, loadMasterclassResources } from '@/app/lib/paid-content';

let db: PGlite;

beforeAll(async () => {
    db = await createLiveSchemaDb();
    state.db = db;
    await createUser(db, MEMBER);
    await db.query(`INSERT INTO masterclasses (id, title, resource_urls, is_published) VALUES ($1, 'Draft', '[{"name":"Workbook","url":"https://files.invalid/workbook.pdf"},{"name":"Private workbook","path":"workbook.pdf"}]', false)`, [MC]);
    await db.query(`INSERT INTO chapters (id, slug, title, video_id, masterclass_id, lab_questions, resource_urls) VALUES ($1, 'm1', 'Module', 'pending_video', $2, '[{"key":"q1","label":"Paid question","placeholder":""},{"key":"q2","label":"Second","placeholder":""}]', '[{"name":"Sheet","path":"sheet.pdf"},{"name":"Gone","path":"missing.pdf"}]')`, [CH, MC]);

    // Closed by migration 30, applied to production 2026-09-26. The bucket it
    // creates lives in storage, outside the dump, so it is inserted here as
    // the migration does -- before asking, because the migration's guard
    // recognises itself by that bucket.
    await db.exec(`INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('vault-resources', 'vault-resources', false, 15728640, ARRAY['application/pdf','application/zip','application/x-zip-compressed','image/jpeg','image/png','image/webp'])`);
    await expectMigrationApplied(db, '20260926_30_paid_content_columns.sql');
}, 60000);

afterAll(async () => { await db?.close(); });

describe.each([['anyone signed out', 'anon', null], ['a member who bought nothing', 'authenticated', MEMBER]] as const)(
    '%s', (_, role, who) => {
        it('cannot read the Essence Lab questions', async () => {
            await expect(asRole(db, role, who, 'SELECT lab_questions FROM chapters')).rejects.toMatchObject({ code: '42501' });
        });

        it('cannot read chapter downloads', async () => {
            await expect(asRole(db, role, who, 'SELECT resource_urls FROM chapters')).rejects.toMatchObject({ code: '42501' });
        });

        it('cannot read masterclass downloads', async () => {
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

describe('paid content, read on the server after the access check', () => {
    it('without access, gives only the question count', async () => {
        const paid = await loadChapterPaidContent(CH, { hasAccess: false });

        expect(paid).toEqual({ labQuestions: [], labQuestionCount: 2, resources: [] });
    });

    it('with access, gives the questions and the masterclass downloads before the module’s own', async () => {
        signed.length = 0;
        const paid = await loadChapterPaidContent(CH, { hasAccess: true });

        expect(paid.labQuestions.map(q => q.key)).toEqual(['q1', 'q2']);
        expect(paid.resources).toEqual([
            { name: 'Workbook', url: 'https://files.invalid/workbook.pdf' },
            { name: 'Private workbook', url: 'https://storage.invalid/sign/vault-resources/workbook.pdf?token=t' },
            { name: 'Sheet', url: 'https://storage.invalid/sign/vault-resources/sheet.pdf?token=t' },
        ]);
        // Signed from the private bucket, for an hour; a file that cannot be
        // signed is left out rather than shown as a dead link.
        expect(signed.every(s => s.bucket === 'vault-resources' && s.seconds === 3600)).toBe(true);
        expect(signed.map(s => s.path)).toContain('missing.pdf');
    });

    it('gives masterclass downloads only with access', async () => {
        expect(await loadMasterclassResources(MC, { hasAccess: false })).toEqual([]);
        expect((await loadMasterclassResources(MC, { hasAccess: true })).map(r => r.name)).toEqual(['Workbook', 'Private workbook']);
    });

    it('gives question definitions only for the chapters asked about', async () => {
        const byChapter = await loadLabQuestionsFor([CH, CH]);

        expect([...byChapter.keys()]).toEqual([CH]);
        expect(await loadLabQuestionsFor([])).toEqual(new Map());
    });
});

describe('the private downloads bucket', () => {
    it('exists, is private, and takes documents', async () => {
        const { rows } = await db.query<{ public: boolean; allowed_mime_types: string[] }>(`SELECT public, allowed_mime_types FROM storage.buckets WHERE id = 'vault-resources'`);
        expect(rows[0].public).toBe(false);
        expect(rows[0].allowed_mime_types).toContain('application/pdf');
    });
});
