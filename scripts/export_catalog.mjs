/**
 * Export the live Vault catalog (masterclasses + chapters) to a fillable JSON
 * file, so content can be authored offline and re-imported with
 * scripts/import_catalog.mjs.
 *
 * The export is the import format: keys are DB column names, a masterclass
 * carries its modules inline, and standalone courses live in their own array.
 * Identity is `masterclasses.title` and `chapters.slug` — never the uuid — so
 * the file stays readable and diffable.
 *
 *   node scripts/export_catalog.mjs                 # -> content/catalog/catalog.json
 *   node scripts/export_catalog.mjs --out other.json
 *
 * Requires DATABASE_URL in .env.local.
 */
import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config({ path: '.env.local', quiet: true });

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing from .env.local');
    process.exit(1);
}

const outArg = process.argv.indexOf('--out');
const outPath = outArg > -1 ? process.argv[outArg + 1] : 'content/catalog/catalog.json';

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

const pick = (row, fields) => Object.fromEntries(fields.map(f => [f, row[f] ?? null]));

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

await client.connect();

const { rows: masterclasses } = await client.query(
    `SELECT id, ${MASTERCLASS_FIELDS.join(', ')} FROM public.masterclasses ORDER BY order_index, title`,
);
const { rows: chapters } = await client.query(
    `SELECT id, masterclass_id, ${CHAPTER_FIELDS.join(', ')} FROM public.chapters ORDER BY order_index, slug`,
);

await client.end();

const doc = {
    $schema: 'docs/CATALOG-CONTENT-GUIDE.md',
    exported_at: new Date().toISOString(),
    masterclasses: masterclasses.map(m => ({
        ...pick(m, MASTERCLASS_FIELDS),
        modules: chapters
            .filter(c => c.masterclass_id === m.id)
            .map(c => pick(c, CHAPTER_FIELDS)),
    })),
    standalone_courses: chapters
        .filter(c => !c.masterclass_id)
        .map(c => pick(c, CHAPTER_FIELDS)),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

console.log(
    `Wrote ${outPath}: ${doc.masterclasses.length} masterclasses, ` +
    `${doc.masterclasses.reduce((n, m) => n + m.modules.length, 0)} modules, ` +
    `${doc.standalone_courses.length} standalone courses.`,
);
