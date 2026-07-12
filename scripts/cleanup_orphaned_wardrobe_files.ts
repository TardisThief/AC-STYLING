// scripts/cleanup_orphaned_wardrobe_files.ts
// Lists studio-wardrobe objects whose folder maps to no live profile or
// wardrobe AND that no wardrobe_items.image_url / lookbooks.thumbnail_url
// references. Dry-run by default; pass --delete to remove them.
//
//   NODE_PATH=./node_modules npx tsx scripts/cleanup_orphaned_wardrobe_files.ts
//   NODE_PATH=./node_modules npx tsx scripts/cleanup_orphaned_wardrobe_files.ts --delete
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const doDelete = process.argv.includes('--delete');
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();

    // lookbooks.thumbnail_url only exists after migration 06; guard the ref so
    // the script runs before or after it is applied.
    const { rows: [{ has_thumb }] } = await c.query(`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'lookbooks'
              AND column_name = 'thumbnail_url'
        ) AS has_thumb
    `);

    const lookbookClause = has_thumb
        ? `AND NOT EXISTS (SELECT 1 FROM public.lookbooks l WHERE l.thumbnail_url LIKE '%' || o.name)`
        : '';

    const { rows } = await c.query(`
        SELECT o.name
        FROM storage.objects o
        WHERE o.bucket_id = 'studio-wardrobe'
          -- folder maps to nothing live (either bare or wardrobe/-prefixed)
          AND NOT EXISTS (SELECT 1 FROM public.profiles p
              WHERE p.id::text IN ((storage.foldername(o.name))[1], (storage.foldername(o.name))[2]))
          AND NOT EXISTS (SELECT 1 FROM public.wardrobes w
              WHERE w.id::text IN ((storage.foldername(o.name))[1], (storage.foldername(o.name))[2]))
          -- and nothing references the file
          AND NOT EXISTS (SELECT 1 FROM public.wardrobe_items wi
              WHERE wi.image_url LIKE '%' || o.name)
          ${lookbookClause}
        ORDER BY o.name
    `);

    console.log(`${rows.length} orphaned object(s):`);
    rows.forEach(r => console.log('  ' + r.name));

    if (!doDelete) {
        console.log('\nDry run. Re-run with --delete to remove them.');
    } else if (rows.length) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        // Supabase caps remove() batch size; chunk to stay well under it.
        for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100).map(r => r.name);
            const { error } = await supabase.storage.from('studio-wardrobe').remove(batch);
            if (error) throw error;
        }
        console.log('Deleted.');
    }
    await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
