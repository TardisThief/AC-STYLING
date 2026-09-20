import { beforeEach, describe, expect, it, vi } from 'vitest';

const { guard, adminClient, from, eq, upsert } = vi.hoisted(() => ({
    guard: vi.fn(), adminClient: vi.fn(), from: vi.fn(), eq: vi.fn(), upsert: vi.fn(),
}));
vi.mock('@/app/lib/auth-guards', () => ({ requireAdmin: guard }));
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: adminClient }));
import { toggleStudioAccess } from '@/app/actions/admin/manage-clients';

beforeEach(() => {
    vi.clearAllMocks();
    adminClient.mockReturnValue({ from });
    from.mockReturnValue({ update: vi.fn(() => ({ eq })), upsert });
    eq.mockResolvedValue({ error:null });
    upsert.mockResolvedValue({ error:null });
});
describe('Privileged studio access changes', () => {
    it('does not create an elevated client for a non-admin', async () => {
        guard.mockResolvedValue({ok:false,error:'Forbidden'});
        expect(await toggleStudioAccess('someone',true)).toEqual({success:false,error:'Forbidden'});
        expect(adminClient).not.toHaveBeenCalled();
    });
    it('uses the trusted server client after admin verification', async () => {
        const browserFrom=vi.fn();
        guard.mockResolvedValue({ok:true,supabase:{from:browserFrom}});
        expect(await toggleStudioAccess('client',true)).toEqual({success:true});
        expect(browserFrom).not.toHaveBeenCalled();
        expect(eq).toHaveBeenCalledWith('id','client');
        expect(upsert).toHaveBeenCalledWith({user_id:'client'},{onConflict:'user_id'});
    });
    it('propagates a denied/failed entitlement write', async () => {
        guard.mockResolvedValue({ok:true});
        eq.mockResolvedValue({error:{message:'Database unavailable'}});
        expect(await toggleStudioAccess('client',true)).toEqual({success:false,error:'Database unavailable'});
        expect(upsert).not.toHaveBeenCalled();
    });
});
