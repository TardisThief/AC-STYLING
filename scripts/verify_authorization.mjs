// Metadata only: no customer rows, writes, or privileged RPC execution.
// Run before/after migration 12: node scripts/verify_authorization.mjs
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
let failures = 0;
function check(name, ok) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
    if (!ok) failures++;
}

try {
    await db.connect();
    await db.query('BEGIN READ ONLY');
    await db.query("SET LOCAL statement_timeout = '15s'");
    const editable = new Set(['full_name', 'username', 'website', 'avatar_url', 'language_preference', 'style_essentials', 'updated_at']);
    for (const role of ['anon', 'authenticated']) {
        const { rows } = await db.query(`
            SELECT attname,
              has_column_privilege($1, 'public.profiles', attname, 'UPDATE') AS can_update,
              has_column_privilege($1, 'public.profiles', attname, 'INSERT') AS can_insert
            FROM pg_attribute WHERE attrelid='public.profiles'::regclass
              AND attnum>0 AND NOT attisdropped`, [role]);
        check(`${role}: only intended profile columns writable`, rows.length > 0 && rows.every(r =>
            !r.can_insert && r.can_update === (role === 'authenticated' && editable.has(r.attname))));
    }
    for (const signature of ['clone_lookbook(uuid,uuid)', 'clone_wardrobe_item(uuid,uuid)', 'check_rate_limit(text,integer,interval)']) {
        const { rows: [r] } = await db.query(`SELECT
            has_function_privilege('anon',$1,'EXECUTE') AS anon,
            has_function_privilege('authenticated',$1,'EXECUTE') AS member,
            has_function_privilege('service_role',$1,'EXECUTE') AS server`, [`public.${signature}`]);
        check(`${signature}: server execution only`, !r.anon && !r.member && r.server);
    }
    const { rows: policies } = await db.query(`SELECT schemaname,tablename,policyname,roles::text,qual,with_check
        FROM pg_policies WHERE (schemaname='public' AND tablename IN
        ('boutique_collections','boutique_collection_items','boutique_clicks','trusted_by_logos'))
        OR (schemaname='storage' AND tablename='objects')`);
    const policy = (table, name) => policies.find(p => p.tablename === table && p.policyname === name);
    const isAdmin = value => value?.includes('get_user_role') && value.includes('auth.uid()') && value.includes("'admin'");
    for (const table of ['boutique_collections','boutique_collection_items']) {
        const p = policy(table, `${table}: admin write`);
        check(`${table}: admin policy`, p?.roles === '{authenticated}' && isAdmin(p.qual) && isAdmin(p.with_check));
    }
    // Migration 26: the homepage logos were writable by any signed-in user.
    const logos = policy('trusted_by_logos', 'trusted_by_logos: admin write');
    const checksAdminRow = value => value?.includes('profiles') && value.includes('auth.uid()') && value.includes("'admin'");
    check('trusted_by_logos: admin write policy', checksAdminRow(logos?.qual) && checksAdminRow(logos?.with_check));
    const clicks = policy('boutique_clicks', 'boutique_clicks: admin read');
    check('click analytics: admin policy', clicks?.roles === '{authenticated}' && isAdmin(clicks.qual));
    const memberClick = policy('boutique_clicks', 'boutique_clicks: authenticated insert');
    const anonClick = policy('boutique_clicks', 'boutique_clicks: anon insert');
    check('click attribution: actor-bound policies', memberClick?.roles === '{authenticated}' &&
        memberClick.with_check?.includes('user_id =') && memberClick.with_check.includes('auth.uid()') &&
        anonClick?.roles === '{anon}' && anonClick.with_check?.includes('user_id IS NULL'));
    const avatar = policy('objects','Avatar owners can upload');
    check('avatars: owner upload policy', !policy('objects','Anyone can upload an avatar.') &&
        avatar?.roles === '{authenticated}' && avatar.with_check?.includes('split_part') && avatar.with_check.includes('auth.uid()'));
    const vault = policy('objects','Admins can upload assets');
    check('vault-assets: admin upload policy', vault?.roles === '{authenticated}' && isAdmin(vault.with_check));
    const { rows: buckets } = await db.query(`SELECT id, public, file_size_limit, allowed_mime_types
        FROM storage.buckets WHERE id IN ('avatars','boutique','studio-wardrobe','vault-assets')`);
    check('four buckets: size/type restrictions', buckets.length === 4 && buckets.every(b =>
        Number(b.file_size_limit) === 15728640 && b.allowed_mime_types?.includes('image/jpeg') &&
        b.allowed_mime_types.every(t => ['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif',
            ...(b.id === 'vault-assets' ? ['application/pdf','application/zip','application/x-zip-compressed'] : [])].includes(t))));
    check('wardrobe bucket stays private', buckets.find(b => b.id === 'studio-wardrobe')?.public === false);
    await db.query('ROLLBACK');
    console.log(`${failures} failed structural checks. Also review all permissive policies and run release smoke tests.`);
    process.exitCode = failures ? 1 : 0;
} catch (error) {
    // Do not print connection strings or database query parameters.
    console.error('Verification failed:', error.code || error.name);
    process.exitCode = 1;
} finally {
    await db.end();
}
