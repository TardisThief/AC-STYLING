// scripts/verify_wardrobe_policy.ts
// Run AFTER applying migration 07. Asserts the owner-or-admin matrix using
// SET LOCAL role + request.jwt.claims to simulate callers against
// public.can_access_wardrobe_object.
//
//   NODE_PATH=./node_modules npx tsx scripts/verify_wardrobe_policy.ts
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkAs(c: Client, userId: string, objectName: string): Promise<boolean> {
    await c.query('BEGIN');
    await c.query(`SET LOCAL role authenticated`);
    await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    const r = await c.query('SELECT public.can_access_wardrobe_object($1) AS ok', [objectName]);
    await c.query('ROLLBACK');
    return r.rows[0].ok === true;
}

async function main() {
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();

    const { rows: [w] } = await c.query(
        `SELECT id, owner_id FROM public.wardrobes WHERE owner_id IS NOT NULL LIMIT 1`);
    const { rows: [admin] } = await c.query(
        `SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1`);
    const { rows: [stranger] } = await c.query(
        `SELECT id FROM public.profiles WHERE role <> 'admin' AND id <> $1 LIMIT 1`, [w?.owner_id]);

    if (!w || !admin) {
        console.error('Need at least one owned wardrobe and one admin profile to run.');
        process.exit(1);
    }

    const cases: Array<[string, string | undefined, string, boolean]> = [
        ['owner reads own folder',          w.owner_id,   `${w.owner_id}/x.jpg`,           true],
        ['owner reads owned wardrobe/',     w.owner_id,   `wardrobe/${w.id}/x.jpg`,        true],
        ['owner reads own intake folder',   w.owner_id,   `wardrobe/${w.owner_id}/x.jpg`,  true],
        ['stranger blocked from folder',    stranger?.id, `${w.owner_id}/x.jpg`,           false],
        ['stranger blocked from wardrobe/', stranger?.id, `wardrobe/${w.id}/x.jpg`,        false],
        ['admin reads anything',            admin.id,     `${w.owner_id}/x.jpg`,           true],
    ];

    let failed = 0;
    for (const [label, uid, obj, expected] of cases) {
        if (!uid) { console.log(`SKIP ${label} (no such user)`); continue; }
        const ok = await checkAs(c, uid, obj);
        const pass = ok === expected;
        if (!pass) failed++;
        console.log(`${pass ? 'PASS' : 'FAIL'} ${label} (got ${ok}, expected ${expected})`);
    }
    await c.end();
    process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
