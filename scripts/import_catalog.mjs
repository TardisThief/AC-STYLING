/**
 * Validate and import a filled catalog file (see scripts/export_catalog.mjs and
 * docs/CATALOG-CONTENT-GUIDE.md) into `masterclasses` + `chapters`.
 *
 *   node scripts/import_catalog.mjs                      # validate + dry run
 *   node scripts/import_catalog.mjs --apply              # write, in one transaction
 *   node scripts/import_catalog.mjs --file other.json
 *
 * Rows are matched by `masterclasses.title` and `chapters.slug`; existing rows
 * are updated in place (uuids, and therefore purchases and access grants,
 * survive), new rows are inserted. Nothing is ever deleted — removing a row
 * from the file leaves the DB row alone.
 *
 * Validation mirrors app/lib/validation/{masterclasses,chapters}.ts plus the DB
 * constraints, and refuses to publish a row whose content is still a
 * placeholder. Requires DATABASE_URL in .env.local.
 */
import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';

dotenv.config({ path: '.env.local', quiet: true });

const APPLY = process.argv.includes('--apply');
const fileArg = process.argv.indexOf('--file');
const FILE = fileArg > -1 ? process.argv[fileArg + 1] : 'content/catalog/catalog.json';

const MASTERCLASS_FIELDS = [
    'title', 'subtitle', 'description',
    'title_es', 'subtitle_es', 'description_es',
    'thumbnail_url', 'video_url', 'order_index',
    'price_display', 'runtime_minutes', 'resource_urls',
    'stripe_product_id', 'price_id',
    'is_published', 'available_at',
];
const CHAPTER_FIELDS = [
    'slug', 'title', 'subtitle', 'description',
    'title_es', 'subtitle_es', 'description_es',
    'video_id', 'video_id_es', 'thumbnail_url',
    'category', 'order_index', 'is_standalone',
    'takeaways', 'takeaways_es', 'lab_questions', 'resource_urls',
    'stripe_product_id', 'price_id',
    'is_published', 'available_at',
];
const JSON_FIELDS = new Set(['takeaways', 'takeaways_es', 'lab_questions', 'resource_urls']);
const MAPPING_CATEGORIES = ['style_words', 'archetype', 'power_features', 'color_energy'];
const PLACEHOLDER = /^(todo|tbd|pending)/i;

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

/** Mirrors app/lib/vimeo.ts — a bare numeric id or a vimeo.com URL. */
function vimeoId(value) {
    const input = String(value ?? '').trim();
    if (!input) return null;
    if (/^\d+$/.test(input)) return input;
    const m = input.match(/^https?:\/\/(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)(?:[/?#]|$)/);
    return m ? m[1] : null;
}

const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const masterclasses = doc.masterclasses ?? [];
const standalone = doc.standalone_courses ?? [];

// --- validation ------------------------------------------------------------
const seenSlugs = new Map();
const seenTitles = new Map();
const seenLabKeys = new Map();

/** Masterclasses and chapters both carry a resource_urls list of { name, url }. */
function checkResources(where, row) {
    const resources = row.resource_urls ?? [];
    if (!Array.isArray(resources)) return err(where, 'resource_urls must be an array');
    resources.forEach((r, i) => {
        if (!r || typeof r !== 'object') return err(where, `resource_urls[${i}] must be an object`);
        if (!r.name?.trim()) err(where, `resource_urls[${i}].name is required`);
        if (!/^https?:\/\//.test(r.url ?? '')) err(where, `resource_urls[${i}].url must be an http(s) URL`);
    });
}

function checkJsonArrays(where, ch) {
    for (const field of ['takeaways', 'takeaways_es']) {
        const list = ch[field] ?? [];
        if (!Array.isArray(list)) { err(where, `${field} must be an array of strings`); continue; }
        if (list.some(t => typeof t !== 'string' || !t.trim())) err(where, `${field} must contain non-empty strings`);
    }

    checkResources(where, ch);

    const questions = ch.lab_questions ?? [];
    if (!Array.isArray(questions)) return err(where, 'lab_questions must be an array');
    questions.forEach((q, i) => {
        const at = `${where} lab_questions[${i}]`;
        if (!q || typeof q !== 'object') return err(at, 'must be an object');
        if (!/^[a-z0-9_]+$/.test(q.key ?? '')) {
            err(at, 'key is required (lowercase letters, digits, underscores)');
        } else if (seenLabKeys.has(q.key)) {
            err(at, `key "${q.key}" is already used by ${seenLabKeys.get(q.key)} — keys must be unique across the whole catalog`);
        } else {
            seenLabKeys.set(q.key, where);
        }
        if (!q.label?.trim()) {
            err(at, q.question?.trim()
                ? 'label is required — the Lab renders `label`, not `question`; rename the key (some legacy rows still use `question` and render a blank prompt)'
                : 'label is required');
        }
        if (!q.label_es?.trim()) warn(at, 'label_es is missing — the Spanish Lab falls back to English');
        if (q.mapToEssence && q.mappingCategory && !MAPPING_CATEGORIES.includes(q.mappingCategory)) {
            err(at, `mappingCategory must be one of ${MAPPING_CATEGORIES.join(', ')}`);
        }
    });
}

function checkChapter(ch, where, { inCourse }) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ch.slug ?? '')) {
        err(where, 'slug is required and must be lowercase-kebab-case');
    } else if (seenSlugs.has(ch.slug)) {
        err(where, `duplicate slug "${ch.slug}" (also ${seenSlugs.get(ch.slug)})`);
    } else {
        seenSlugs.set(ch.slug, where);
    }

    if (!ch.title?.trim()) err(where, 'title is required');
    if (!ch.description?.trim()) warn(where, 'description is empty');
    if (!ch.title_es?.trim()) warn(where, 'title_es is missing — Spanish visitors see the English title');
    if (!['masterclass', 'course'].includes(ch.category ?? 'masterclass')) err(where, "category must be 'masterclass' or 'course'");
    if (!Number.isInteger(ch.order_index)) err(where, 'order_index must be an integer');

    if (!String(ch.video_id ?? '').trim()) {
        err(where, 'video_id is required (NOT NULL in the DB)');
    } else if (!vimeoId(ch.video_id)) {
        const msg = 'video_id is not a Vimeo id or URL — playback will fail';
        if (PLACEHOLDER.test(ch.video_id) && !ch.is_published) warn(where, `${msg} (placeholder, row is unpublished)`);
        else err(where, msg);
    }
    if (String(ch.video_id_es ?? '').trim() && !vimeoId(ch.video_id_es) && !PLACEHOLDER.test(ch.video_id_es)) {
        err(where, 'video_id_es is not a Vimeo id or URL');
    }

    if (inCourse && ch.is_standalone) err(where, 'is_standalone must be false for a module inside a masterclass');
    if (!inCourse && ch.is_standalone === false) err(where, 'a standalone course must have is_standalone: true');
    if (!inCourse && ch.category !== 'course') warn(where, "a standalone course usually has category 'course'");

    if (ch.is_published) {
        if (!vimeoId(ch.video_id)) err(where, 'cannot publish: video_id is still a placeholder');
        if (!ch.description?.trim()) err(where, 'cannot publish: description is empty');
        if (!inCourse && !ch.thumbnail_url) err(where, 'cannot publish a standalone course without a thumbnail_url');
        if (!inCourse && !ch.stripe_product_id) warn(where, 'published standalone course has no stripe_product_id — it cannot be bought on its own');
    }

    checkJsonArrays(where, ch);
}

masterclasses.forEach((m, i) => {
    const where = `masterclass "${m.title ?? `#${i}`}"`;
    if (!m.title?.trim()) err(where, 'title is required and is the match key');
    else if (seenTitles.has(m.title)) err(where, 'duplicate masterclass title');
    else seenTitles.set(m.title, where);

    if (!m.description?.trim()) warn(where, 'description is empty');
    if (!m.title_es?.trim()) warn(where, 'title_es is missing');
    if (!Number.isInteger(m.order_index)) err(where, 'order_index must be an integer');
    if (m.runtime_minutes != null && !(Number.isInteger(m.runtime_minutes) && m.runtime_minutes > 0)) {
        err(where, 'runtime_minutes must be a positive integer or null');
    }
    if (String(m.video_url ?? '').trim() && !vimeoId(m.video_url)) {
        warn(where, 'video_url is not a Vimeo URL — the teaser simply will not render');
    }
    if (m.available_at && Number.isNaN(Date.parse(m.available_at))) err(where, 'available_at must be an ISO timestamp or null');

    checkResources(where, m);

    if (m.is_published) {
        if (!m.thumbnail_url) err(where, 'cannot publish without a thumbnail_url — the catalog card needs it');
        if (!m.description?.trim()) err(where, 'cannot publish without a description');
        if (!m.price_display) err(where, 'cannot publish without price_display — the card would show no price');
        if (!m.stripe_product_id || !m.price_id) err(where, 'cannot publish without stripe_product_id and price_id — it could not be bought');
        if (!(m.modules ?? []).some(c => c.is_published)) err(where, 'cannot publish: no module is published');
    }

    (m.modules ?? []).forEach((ch, j) => checkChapter(ch, `module "${ch.slug ?? `${m.title}#${j}`}"`, { inCourse: true }));
});

standalone.forEach((ch, i) => checkChapter(ch, `standalone course "${ch.slug ?? `#${i}`}"`, { inCourse: false }));

// --- report ----------------------------------------------------------------
warnings.forEach(w => console.log(`  warn  ${w}`));
errors.forEach(e => console.log(`  ERROR ${e}`));
console.log(
    `\n${FILE}: ${masterclasses.length} masterclasses, `
    + `${masterclasses.reduce((n, m) => n + (m.modules?.length ?? 0), 0)} modules, `
    + `${standalone.length} standalone courses — ${errors.length} errors, ${warnings.length} warnings.`,
);
if (errors.length) {
    console.error('\nNothing was written. Fix the errors above and re-run.');
    process.exit(1);
}
if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.');
    process.exit(0);
}

// --- write -----------------------------------------------------------------
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing from .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});
await client.connect();

const value = (row, field) => {
    const v = row[field];
    if (JSON_FIELDS.has(field)) return JSON.stringify(v ?? []);
    return v === '' ? null : v ?? null;
};

/** chapters.slug is UNIQUE, so modules and courses upsert on it directly. */
async function upsertChapter(ch, masterclassId) {
    const cols = [...CHAPTER_FIELDS, 'masterclass_id'];
    const values = [...CHAPTER_FIELDS.map(f => value(ch, f)), masterclassId];
    const params = cols.map((_, i) => `$${i + 1}`);
    const updates = cols.filter(c => c !== 'slug').map(c => `${c} = EXCLUDED.${c}`);
    await client.query(
        `INSERT INTO public.chapters (${cols.join(', ')}, updated_at)
         VALUES (${params.join(', ')}, now())
         ON CONFLICT (slug) DO UPDATE SET ${updates.join(', ')}, updated_at = now()`,
        values,
    );
}

let inserted = 0;
try {
    await client.query('BEGIN');

    // masterclasses.title has no unique constraint, so match by hand.
    for (const m of masterclasses) {
        const { rows } = await client.query('SELECT id FROM public.masterclasses WHERE title = $1', [m.title]);
        let id = rows[0]?.id;
        if (id) {
            const sets = MASTERCLASS_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(', ');
            await client.query(
                `UPDATE public.masterclasses SET ${sets}, updated_at = now() WHERE id = $1`,
                [id, ...MASTERCLASS_FIELDS.map(f => value(m, f))],
            );
        } else {
            const params = MASTERCLASS_FIELDS.map((_, i) => `$${i + 1}`);
            const res = await client.query(
                `INSERT INTO public.masterclasses (${MASTERCLASS_FIELDS.join(', ')}) VALUES (${params.join(', ')}) RETURNING id`,
                MASTERCLASS_FIELDS.map(f => value(m, f)),
            );
            id = res.rows[0].id;
            inserted += 1;
        }
        for (const ch of m.modules ?? []) await upsertChapter(ch, id);
    }

    for (const ch of standalone) await upsertChapter(ch, null);

    await client.query('COMMIT');
} catch (e) {
    await client.query('ROLLBACK');
    console.error('Import failed and was rolled back:', e.message);
    await client.end();
    process.exit(1);
}

await client.end();
console.log(`Applied. ${inserted} new masterclass row(s); every other row updated in place.`);
console.log('Redeploy or revalidate the "vault-catalog" cache tag for the public sales page to pick it up.');
