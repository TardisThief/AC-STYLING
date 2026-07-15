// scripts/verify_internal_note_privacy.ts
// Run AFTER applying migration 20260715_08_private_internal_note.sql.
//
// Asserts that wardrobe_items.internal_note is unreachable from the browser
// role while the columns the app actually renders stay readable. Uses
// SET LOCAL role to simulate an `authenticated` caller, exactly as PostgREST
// would, and rolls everything back.
//
//   NODE_PATH=./node_modules npx tsx scripts/verify_internal_note_privacy.ts
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type Check = { name: string; ok: boolean; detail: string };

async function asRole<T>(c: Client, role: string, fn: () => Promise<T>): Promise<T> {
    await c.query('BEGIN');
    await c.query(`SET LOCAL role ${role}`);
    try {
        return await fn();
    } finally {
        await c.query('ROLLBACK');
    }
}

/** Returns null when the statement succeeded, or the error message when it failed. */
async function attempt(c: Client, sql: string): Promise<string | null> {
    try {
        await c.query(sql);
        return null;
    } catch (e) {
        return (e as Error).message;
    }
}

async function main() {
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();

    const checks: Check[] = [];

    // 1. authenticated must NOT be able to read internal_note.
    const readPrivate = await asRole(c, 'authenticated', () =>
        attempt(c, 'SELECT internal_note FROM public.wardrobe_items LIMIT 1')
    );
    checks.push({
        name: 'authenticated CANNOT select internal_note',
        ok: readPrivate !== null && /permission denied/i.test(readPrivate),
        detail: readPrivate ?? 'read SUCCEEDED — the private note is still exposed',
    });

    // 2. select * must fail too — that is the shape the old client code used.
    const readStar = await asRole(c, 'authenticated', () =>
        attempt(c, 'SELECT * FROM public.wardrobe_items LIMIT 1')
    );
    checks.push({
        name: "authenticated CANNOT select * (would include internal_note)",
        ok: readStar !== null && /permission denied/i.test(readStar),
        detail: readStar ?? 'select * SUCCEEDED — internal_note is reachable',
    });

    // 3. The columns the app renders must still be readable.
    const readAllowed = await asRole(c, 'authenticated', () =>
        attempt(
            c,
            `SELECT id, user_id, wardrobe_id, image_url, category, client_note, notes,
                    brand, status, tags, product_link_id, is_general_library,
                    created_at, updated_at
             FROM public.wardrobe_items LIMIT 1`
        )
    );
    checks.push({
        name: 'authenticated CAN select the client-visible columns',
        ok: readAllowed === null,
        detail: readAllowed ?? 'ok',
    });

    // 4. authenticated must NOT be able to write internal_note.
    const writePrivate = await asRole(c, 'authenticated', () =>
        attempt(c, `UPDATE public.wardrobe_items SET internal_note = 'x'`)
    );
    checks.push({
        name: 'authenticated CANNOT update internal_note',
        ok: writePrivate !== null && /permission denied/i.test(writePrivate),
        detail: writePrivate ?? 'update SUCCEEDED — a client could overwrite the private note',
    });

    // 5. Clients must still be able to edit their own note / category.
    const writeAllowed = await asRole(c, 'authenticated', () =>
        attempt(c, `UPDATE public.wardrobe_items SET client_note = 'x', category = 'Tops'`)
    );
    checks.push({
        name: 'authenticated CAN update client_note / category',
        ok: writeAllowed === null,
        detail: writeAllowed ?? 'ok',
    });

    // 6. anon must not read the private note either.
    const anonRead = await asRole(c, 'anon', () =>
        attempt(c, 'SELECT internal_note FROM public.wardrobe_items LIMIT 1')
    );
    checks.push({
        name: 'anon CANNOT select internal_note',
        ok: anonRead !== null && /permission denied/i.test(anonRead),
        detail: anonRead ?? 'read SUCCEEDED — the private note is exposed to anon',
    });

    // 7. The service role (how Ale reads it) must still see everything.
    const serviceRead = await asRole(c, 'service_role', () =>
        attempt(c, 'SELECT internal_note FROM public.wardrobe_items LIMIT 1')
    );
    checks.push({
        name: 'service_role CAN still select internal_note (admin path)',
        ok: serviceRead === null,
        detail: serviceRead ?? 'ok',
    });

    console.log('\n--- internal_note privacy (migration 08) ---\n');
    let passed = 0;
    for (const check of checks) {
        console.log(`  ${check.ok ? 'PASS' : 'FAIL'}  ${check.name}`);
        if (!check.ok) console.log(`        ${check.detail}`);
        if (check.ok) passed++;
    }
    console.log(`\n  ${passed}/${checks.length} passed\n`);

    await c.end();
    process.exit(passed === checks.length ? 0 : 1);
}

main().catch(e => {
    console.error(e.message);
    process.exit(1);
});
