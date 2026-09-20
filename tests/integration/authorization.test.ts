// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const adminId = '00000000-0000-4000-8000-000000000003';
let db: PGlite;

async function asRole(role: 'anon' | 'authenticated' | 'service_role', id: string | null, sql: string) {
    await db.exec('BEGIN');
    try {
        await db.exec(`SET LOCAL ROLE ${role}`);
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id ?? '']);
        return await db.query(sql);
    } finally {
        await db.exec('ROLLBACK');
    }
}

beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync('tests/fixtures/authorization.sql', 'utf8'));
    await db.query("INSERT INTO profiles (id,full_name,role) VALUES ($1,'Owner','user'),($2,'Other','user'),($3,'Stylist','admin')", [userId,otherId,adminId]);
    await db.exec("INSERT INTO storage.buckets (id,public) VALUES ('avatars',true),('boutique',true),('studio-wardrobe',false),('vault-assets',true)");
    await db.exec("INSERT INTO boutique_collections (title) VALUES ('Original')");
    // Prove this fixture reproduces the original privilege escalation first.
    const vulnerable = await asRole('authenticated', userId, `UPDATE profiles SET role='admin' WHERE id='${userId}' RETURNING role`);
    expect(vulnerable.rows).toEqual([{ role: 'admin' }]);
    await db.exec(readFileSync('supabase/migrations/20260919_12_authorization_boundaries.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });

describe('Profile write boundaries in PostgreSQL', () => {
    it.each(['role', 'has_full_unlock', 'has_course_pass', 'active_studio_client', 'studio_permissions', 'status', 'intake_token', 'email', 'id'])('denies ordinary-user writes to %s', async column => {
        await expect(asRole('authenticated', userId, `UPDATE profiles SET ${column}=${column} WHERE id='${userId}'`)).rejects.toMatchObject({ code:'42501' });
    });
    it('preserves the owner’s ordinary profile edits', async () => {
        const result = await asRole('authenticated', userId, `UPDATE profiles SET full_name='Updated' WHERE id='${userId}' RETURNING full_name`);
        expect(result.rows).toEqual([{full_name:'Updated'}]);
    });
    it('does not allow editing someone else’s ordinary profile', async () => {
        const result = await asRole('authenticated', userId, `UPDATE profiles SET full_name='Updated' WHERE id='${otherId}' RETURNING id`);
        expect(result.rows).toEqual([]);
    });
    it.each(['anon','authenticated'] as const)('denies direct profile insertion as %s', async role => {
        await expect(asRole(role, userId, "INSERT INTO profiles(id,role) VALUES(gen_random_uuid(),'admin')")).rejects.toMatchObject({code:'42501'});
    });
    it('requires even an admin browser to use server-side privilege mutations', async () => {
        await expect(asRole('authenticated', adminId, `UPDATE profiles SET has_full_unlock=true WHERE id='${userId}'`)).rejects.toMatchObject({code:'42501'});
    });
    it('preserves trusted server grants', async () => {
        const result = await asRole('service_role', null, `UPDATE profiles SET has_full_unlock=true WHERE id='${userId}' RETURNING has_full_unlock`);
        expect(result.rows).toEqual([{has_full_unlock:true}]);
    });
});

describe('Privileged RPC permissions', () => {
    it.each(['anon','authenticated'] as const)('denies direct rate counter manipulation as %s', async role => {
        await expect(asRole(role,userId,"SELECT check_rate_limit('email:victim@example.invalid',100,'0 seconds')")).rejects.toMatchObject({code:'42501'});
    });
    it('retains working atomic limits for the service role', async () => {
        const result = await asRole('service_role',null,"SELECT check_rate_limit('test',1,'1 hour') AS allowed");
        expect(result.rows).toEqual([{allowed:true}]);
    });
    it.each(['clone_wardrobe_item','clone_lookbook'])('denies unauthenticated %s execution', async fn => {
        await expect(asRole('anon',null,`SELECT ${fn}('${userId}','${otherId}')`)).rejects.toMatchObject({code:'42501'});
    });
});

describe('Boutique policies', () => {
    it('denies ordinary-user collection creation', async () => {
        await expect(asRole('authenticated',userId,"INSERT INTO boutique_collections(title) VALUES('Injected')")).rejects.toMatchObject({code:'42501'});
    });
    it('denies ordinary-user collection updates/deletes', async () => {
        expect((await asRole('authenticated',userId,"UPDATE boutique_collections SET title='Changed' RETURNING id")).rows).toEqual([]);
        expect((await asRole('authenticated',userId,'DELETE FROM boutique_collections RETURNING id')).rows).toEqual([]);
    });
    it('preserves admin collection editing', async () => {
        expect((await asRole('authenticated',adminId,"UPDATE boutique_collections SET title='Edited' RETURNING title")).rows).toEqual([{title:'Edited'}]);
    });
    it('denies forged click attribution', async () => {
        await expect(asRole('authenticated',userId,`INSERT INTO boutique_clicks(item_id,user_id) VALUES(gen_random_uuid(),'${otherId}')`)).rejects.toMatchObject({code:'42501'});
    });
    it('allows own and anonymous clicks', async () => {
        await expect(asRole('authenticated',userId,`INSERT INTO boutique_clicks(item_id,user_id) VALUES(gen_random_uuid(),'${userId}')`)).resolves.toBeDefined();
        await expect(asRole('anon',null,'INSERT INTO boutique_clicks(item_id,user_id) VALUES(gen_random_uuid(),NULL)')).resolves.toBeDefined();
    });
    it('hides click data from members but allows admin analytics', async () => {
        await db.exec(`INSERT INTO boutique_clicks(item_id,user_id) VALUES(gen_random_uuid(),'${otherId}')`);
        expect((await asRole('authenticated',userId,'SELECT * FROM boutique_clicks')).rows).toHaveLength(0);
        expect((await asRole('authenticated',adminId,'SELECT * FROM boutique_clicks')).rows).toHaveLength(1);
    });
    it('allows collection membership writes only for admins', async () => {
        const sql='INSERT INTO boutique_collection_items(collection_id,item_id) VALUES(gen_random_uuid(),gen_random_uuid())';
        await expect(asRole('authenticated',userId,sql)).rejects.toMatchObject({code:'42501'});
        await expect(asRole('authenticated',adminId,sql)).resolves.toBeDefined();
    });
});

describe('Storage authorization', () => {
    it('denies anonymous avatar uploads', async () => {
        await expect(asRole('anon',null,"INSERT INTO storage.objects(bucket_id,name) VALUES('avatars','anything.png')")).rejects.toMatchObject({code:'42501'});
    });
    it('permits only the owner folder for avatar uploads', async () => {
        await expect(asRole('authenticated',userId,`INSERT INTO storage.objects(bucket_id,name) VALUES('avatars','${otherId}/a.png')`)).rejects.toMatchObject({code:'42501'});
        await expect(asRole('authenticated',userId,`INSERT INTO storage.objects(bucket_id,name) VALUES('avatars','${userId}/a.png')`)).resolves.toBeDefined();
    });
    it('permits admin but not member Vault uploads', async () => {
        const sql="INSERT INTO storage.objects(bucket_id,name) VALUES('vault-assets','a.pdf')";
        await expect(asRole('authenticated',userId,sql)).rejects.toMatchObject({code:'42501'});
        await expect(asRole('authenticated',adminId,sql)).resolves.toBeDefined();
    });
    it('sets byte/type restrictions without changing wardrobe privacy', async () => {
        const result=await db.query<{id:string;public:boolean;file_size_limit:number;allowed_mime_types:string[]}>('SELECT * FROM storage.buckets');
        for(const bucket of result.rows){
            expect(Number(bucket.file_size_limit)).toBe(15*1024*1024);
            expect(bucket.allowed_mime_types).not.toContain('text/html');
            expect(bucket.allowed_mime_types).not.toContain('image/svg+xml');
        }
        expect(result.rows.find(b=>b.id==='studio-wardrobe')?.public).toBe(false);
        expect(result.rows.find(b=>b.id==='vault-assets')?.allowed_mime_types).toContain('application/pdf');
    });
});
