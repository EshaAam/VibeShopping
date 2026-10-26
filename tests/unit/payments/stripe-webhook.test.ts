/**
 * The webhook's status code is its retry policy: 200 tells Stripe to stop,
 * anything else makes it retry for days. A permanent rejection must be a 200
 * and a transient failure must not be, or payments get lost or spammed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { constructEvent, markOrderPaid } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  markOrderPaid: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({ stripe: { webhooks: { constructEvent } } }));
vi.mock('@/lib/payments', () => ({ markOrderPaid }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/stripe/route';

function request(signature: string | null = 'sig') {
  return new NextRequest('http://test/api/webhooks/stripe', {
    method: 'POST',
    body: '{"raw":"body"}',
    headers: signature ? { 'stripe-signature': signature } : {},
  });
}

const event = (type: string) => ({ id: 'evt_1', type, data: { object: { id: 'pi_1' } } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('stripe webhook', () => {
  it('PAY-09: refuses with 500 when the secret is not configured', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it('PAY-10: 400 without a signature header', async () => {
    const res = await POST(request(null));
    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it('PAY-10: 400 when the signature does not verify', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const res = await POST(request('forged'));
    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it('verifies the signature against the raw body, not parsed JSON', async () => {
    constructEvent.mockReturnValue(event('charge.updated'));
    await POST(request('sig'));
    expect(constructEvent).toHaveBeenCalledWith('{"raw":"body"}', 'sig', 'whsec_test');
  });

  it('marks the order paid on payment_intent.succeeded', async () => {
    constructEvent.mockReturnValue(event('payment_intent.succeeded'));
    markOrderPaid.mockResolvedValue({ status: 'paid', orderId: 'o1' });

    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(markOrderPaid).toHaveBeenCalledWith({ id: 'pi_1' });
  });

  it('PAY-11: a business rejection is acknowledged with 200 (retrying cannot help)', async () => {
    constructEvent.mockReturnValue(event('payment_intent.succeeded'));
    markOrderPaid.mockResolvedValue({ status: 'rejected', reason: 'amount mismatch' });

    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('amount mismatch'));
  });

  it('PAY-12: an unexpected failure returns 500 so Stripe retries', async () => {
    constructEvent.mockReturnValue(event('payment_intent.succeeded'));
    markOrderPaid.mockRejectedValue(new Error('database unreachable'));

    const res = await POST(request());
    expect(res.status).toBe(500);
  });

  it('PAY-13: other event types are acknowledged and ignored', async () => {
    constructEvent.mockReturnValue(event('customer.created'));

    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });
});
