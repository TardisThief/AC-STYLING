// @vitest-environment node
/**
 * The webhook's front door, attacked with the REAL Stripe SDK.
 *
 * tests/unit/stripe-webhook.test.ts mocks `constructEvent`, so it can only
 * check what the route does with a verdict; it cannot check the verdict. Here
 * the SDK verifies real HMAC signatures against a test-only secret, so a
 * forged, stale or transplanted delivery has to get past Stripe's own code.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';

const SECRET = 'whsec_test_only_not_a_real_secret';
const h = vi.hoisted(() => ({ signature: null as string | null, from: null as unknown }));

vi.mock('@/utils/stripe', () => ({ stripe: new Stripe('sk_test_not_a_real_key') }));
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => ({ from: h.from }) }));
vi.mock('next/headers', () => ({
    headers: async () => new Headers(h.signature === null ? {} : { 'Stripe-Signature': h.signature }),
}));

import { POST } from '@/app/api/webhooks/stripe/route';

const sdk = new Stripe('sk_test_not_a_real_key');
// An event type the route acknowledges without touching the database, so a
// 200 means "verified", nothing more.
const body = JSON.stringify({ id: 'evt_sig_1', object: 'event', type: 'customer.created', data: { object: {} } });

function sign(payload: string, secret = SECRET, timestamp?: number) {
    return sdk.webhooks.generateTestHeaderString({ payload, secret, timestamp });
}

async function post(payload: string) {
    const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: payload }));
    return res.status;
}

beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    h.from = vi.fn(() => { throw new Error('database touched before the signature was verified'); });
});

describe('Stripe webhook signature', () => {
    it('accepts a correctly signed delivery (control)', async () => {
        h.signature = sign(body);
        expect(await post(body)).toBe(200);
    });

    it('rejects a delivery with no signature header', async () => {
        h.signature = null;
        expect(await post(body)).toBe(400);
    });

    it('rejects a signature made with a different secret', async () => {
        h.signature = sign(body, 'whsec_someone_elses_secret');
        expect(await post(body)).toBe(400);
    });

    it('rejects a valid signature transplanted onto a different body', async () => {
        h.signature = sign(body);
        const forged = body.replace('customer.created', 'checkout.session.completed');
        expect(await post(forged)).toBe(400);
        expect(h.from).not.toHaveBeenCalled();
    });

    it('rejects a replay of a genuine delivery outside the tolerance window', async () => {
        h.signature = sign(body, SECRET, Math.floor(Date.now() / 1000) - 60 * 60);
        expect(await post(body)).toBe(400);
    });

    it('refuses to run at all without a configured secret', async () => {
        delete process.env.STRIPE_WEBHOOK_SECRET;
        h.signature = sign(body);
        expect(await post(body)).toBe(500);
    });

    it('does not accept an empty secret as "configured"', async () => {
        process.env.STRIPE_WEBHOOK_SECRET = '';
        h.signature = sign(body, '');
        expect(await post(body)).toBe(500);
    });
});
