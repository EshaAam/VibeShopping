/**
 * markOrderPaid is the one gate between "Stripe says succeeded" and "order is
 * paid". It must refuse anything that doesn't prove the full amount arrived for
 * this exact order, and never touch the order when it refuses.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, recordPayment } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  recordPayment: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/orders', () => ({ recordPayment }));
vi.mock('@/lib/stripe', () => ({ stripe: {} }));
vi.mock('@/db/prisma', () => ({
  prisma: {
    order: { findUnique },
    $transaction: (fn: (tx: unknown) => unknown) => fn('tx'),
  },
}));

import type Stripe from 'stripe';
import { markOrderPaid } from '@/lib/payments';

const intent = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'pi_1',
    status: 'succeeded',
    amount_received: 1234,
    currency: 'usd',
    metadata: { orderId: 'order-1' },
    ...overrides,
  }) as unknown as Stripe.PaymentIntent;

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  totalPrice: '12.34',
  orderStatus: 'Pending',
  user: { email: 'buyer@test.io' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(order());
  recordPayment.mockResolvedValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('markOrderPaid', () => {
  it('PAY-01: rejects an intent that has not succeeded', async () => {
    const result = await markOrderPaid(intent({ status: 'processing' }));
    expect(result).toEqual({ status: 'rejected', reason: 'Payment not successful' });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('PAY-02: rejects an intent with no order id', async () => {
    const result = await markOrderPaid(intent({ metadata: {} }));
    expect(result.status).toBe('rejected');
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it('rejects an intent for an order that does not exist', async () => {
    findUnique.mockResolvedValue(null);
    expect(await markOrderPaid(intent())).toEqual({
      status: 'rejected',
      reason: 'Order not found',
    });
  });

  it('PAY-03: rejects a payment one cent short', async () => {
    const result = await markOrderPaid(intent({ amount_received: 1233 }));
    expect(result).toEqual({
      status: 'rejected',
      reason: 'Paid amount does not match the order total',
    });
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it('PAY-03: rejects the right number in the wrong currency', async () => {
    const result = await markOrderPaid(intent({ currency: 'eur' }));
    expect(result.status).toBe('rejected');
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it('PAY-04: does not resurrect a cancelled order, and flags the refund', async () => {
    findUnique.mockResolvedValue(order({ orderStatus: 'Cancelled' }));

    const result = await markOrderPaid(intent());
    expect(result).toEqual({ status: 'rejected', reason: 'Order was cancelled' });
    expect(recordPayment).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('refund required'));
  });

  it('records the payment as the system, with the amount Stripe actually received', async () => {
    expect(await markOrderPaid(intent())).toEqual({ status: 'paid', orderId: 'order-1' });

    expect(recordPayment).toHaveBeenCalledWith('tx', 'order-1', {
      actorId: null,
      paymentResult: {
        id: 'pi_1',
        status: 'succeeded',
        email_address: 'buyer@test.io',
        pricePaid: '12.34',
      },
    });
  });

  it('PAY-05: a duplicate delivery reports already-paid instead of failing', async () => {
    recordPayment.mockResolvedValue(false);
    expect(await markOrderPaid(intent())).toEqual({
      status: 'already-paid',
      orderId: 'order-1',
    });
  });
});
