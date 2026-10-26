/**
 * Cancelling a paid Stripe order used to restock and log the cancel while the
 * money stayed in Stripe. Now the refund comes first, and a failed refund
 * leaves the order untouched - never "cancelled but still charged".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { orderFindUnique, transaction, transitionOrder, refundsCreate } = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  transitionOrder: vi.fn(async () => {}),
  refundsCreate: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/auth-guard', () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1', role: 'admin' } })),
  requireOrderOwner: vi.fn(),
}));
vi.mock('@/db/prisma', () => ({
  prisma: { order: { findUnique: orderFindUnique }, $transaction: transaction },
}));
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: refundsCreate } } }));
vi.mock('@/lib/orders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/orders')>()),
  transitionOrder,
}));

import { updateOrderStatus } from '@/lib/actions/order.actions';

const order = (overrides: Record<string, unknown>) => ({
  id: 'order-1',
  orderStatus: 'Processing',
  isPaid: true,
  paymentMethod: 'Stripe',
  paymentResult: { id: 'pi_123' },
  totalPrice: { toString: () => '120.00' },
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('admin cancels an order', () => {
  it('refunds a paid Stripe order before cancelling it, once per order', async () => {
    orderFindUnique.mockResolvedValue(order({}));
    refundsCreate.mockResolvedValue({ id: 're_1', amount: 12000, status: 'succeeded' });

    const res = await updateOrderStatus('order-1', 'Cancelled');

    expect(res).toMatchObject({ success: true, message: expect.stringContaining('$120.00 refunded') });
    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_123' }),
      { idempotencyKey: 'refund-order-order-1' }
    );
    expect(transitionOrder).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      'Cancelled',
      expect.objectContaining({ eventData: { refund: { refundId: 're_1', amount: '120.00', status: 'succeeded' } } })
    );
    // refund happened before the cancel
    expect(refundsCreate.mock.invocationCallOrder[0]).toBeLessThan(
      transitionOrder.mock.invocationCallOrder[0]
    );
  });

  it('leaves the order untouched when the refund fails', async () => {
    orderFindUnique.mockResolvedValue(order({}));
    refundsCreate.mockRejectedValue(new Error('Stripe is down'));

    const res = await updateOrderStatus('order-1', 'Cancelled');

    expect(res).toMatchObject({ success: false, message: 'Stripe is down' });
    expect(transitionOrder).not.toHaveBeenCalled();
  });

  it('refuses before refunding when the order can no longer be cancelled', async () => {
    orderFindUnique.mockResolvedValue(order({ orderStatus: 'Shipped' }));

    const res = await updateOrderStatus('order-1', 'Cancelled');

    expect(res.success).toBe(false);
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(transitionOrder).not.toHaveBeenCalled();
  });

  it('flags a paid cash-on-delivery order for a manual refund', async () => {
    orderFindUnique.mockResolvedValue(
      order({ paymentMethod: 'CashOnDelivery', paymentResult: { id: 'COD_1' } })
    );

    const res = await updateOrderStatus('order-1', 'Cancelled');

    expect(res.message).toMatch(/refund the customer manually/);
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(transitionOrder).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      'Cancelled',
      expect.objectContaining({ eventData: { refund: 'manual', amount: '120.00' } })
    );
  });

  it('just cancels an unpaid order', async () => {
    orderFindUnique.mockResolvedValue(order({ isPaid: false, orderStatus: 'Pending' }));

    const res = await updateOrderStatus('order-1', 'Cancelled');

    expect(res).toMatchObject({ success: true, message: 'Order has been cancelled successfully' });
    expect(refundsCreate).not.toHaveBeenCalled();
  });
});
