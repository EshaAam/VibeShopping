/**
 * The order state machine in lib/orders.ts, driven through a fake transaction.
 * Every allowed move must append a matching event; every other move must be
 * refused before anything is written.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderStatus } from '@prisma/client';

const { authMock, tx } = vi.hoisted(() => ({
  authMock: vi.fn(),
  tx: {
    order: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    orderEvent: { create: vi.fn() },
    orderItem: { findMany: vi.fn() },
    product: { update: vi.fn() },
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/stripe', () => ({ stripe: {} }));
vi.mock('@/db/prisma', () => ({
  prisma: {
    ...tx,
    // requireUser re-reads the live role
    user: { findUnique: async () => ({ role: 'admin' }) },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

import { ORDER_TRANSITIONS, recordPayment, transitionOrder } from '@/lib/orders';
import { deliverOrder, updateOrderStatus } from '@/lib/actions/order.actions';

type Tx = Parameters<typeof transitionOrder>[0];
const fakeTx = tx as unknown as Tx;

const STATUSES: OrderStatus[] = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const TARGETS = STATUSES.filter((s) => s !== 'Pending') as Exclude<OrderStatus, 'Pending'>[];

const allowed = STATUSES.flatMap((from) =>
  ORDER_TRANSITIONS[from].map((to) => [from, to] as [OrderStatus, Exclude<OrderStatus, 'Pending'>])
);
const disallowed = STATUSES.flatMap((from) =>
  TARGETS.filter((to) => !ORDER_TRANSITIONS[from].includes(to)).map((to) => [from, to] as const)
);

function orderIn(status: OrderStatus, extra: Record<string, unknown> = {}) {
  const order = { id: 'order-1', orderStatus: status, isPaid: false, ...extra };
  tx.order.findUnique.mockResolvedValue(order);
  tx.order.findFirst.mockResolvedValue(order);
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.order.updateMany.mockResolvedValue({ count: 1 });
  tx.orderItem.findMany.mockResolvedValue([]);
  authMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
});

describe('transitionOrder', () => {
  it.each(allowed)('ORD-01: %s -> %s is allowed and logged', async (from, to) => {
    orderIn(from, { isPaid: true });
    await transitionOrder(fakeTx, 'order-1', to, { actorId: 'admin-1' });

    // Conditional on the status we validated, so a concurrent change loses
    expect(tx.order.updateMany.mock.calls[0][0].where).toEqual({
      id: 'order-1',
      orderStatus: from,
    });
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 'order-1', type: to, actorId: 'admin-1' }),
    });
  });

  it.each(disallowed)('ORD-02: %s -> %s is refused before any write', async (from, to) => {
    orderIn(from);
    await expect(
      transitionOrder(fakeTx, 'order-1', to, { actorId: 'admin-1' })
    ).rejects.toThrow(`Cannot change status from ${from} to ${to}`);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('ORD-03: losing a race to another admin is reported, not silently applied', async () => {
    orderIn('Processing');
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      transitionOrder(fakeTx, 'order-1', 'Shipped', { actorId: 'admin-1' })
    ).rejects.toThrow(/please refresh/);
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('ORD-04: cancelling puts every line back in stock', async () => {
    orderIn('Processing');
    tx.orderItem.findMany.mockResolvedValue([
      { productId: 'p1', qty: 2 },
      { productId: 'p2', qty: 1 },
    ]);

    await transitionOrder(fakeTx, 'order-1', 'Cancelled', { actorId: 'user-1' });

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stock: { increment: 2 } },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'p2' },
      data: { stock: { increment: 1 } },
    });
  });

  it('ORD-05: shipping stores the tracking number on the order and the event', async () => {
    orderIn('Processing');
    await transitionOrder(fakeTx, 'order-1', 'Shipped', {
      actorId: 'admin-1',
      trackingNumber: 'TRK123',
    });

    expect(tx.order.updateMany.mock.calls[0][0].data).toEqual({
      orderStatus: 'Shipped',
      trackingNumber: 'TRK123',
    });
    expect(tx.orderEvent.create.mock.calls[0][0].data.data).toEqual({ trackingNumber: 'TRK123' });
  });

  it('delivering sets the delivered flag and timestamp the CHECK constraint requires', async () => {
    orderIn('Shipped', { isPaid: true });
    await transitionOrder(fakeTx, 'order-1', 'Delivered', { actorId: 'admin-1' });

    expect(tx.order.updateMany.mock.calls[0][0].data).toEqual({
      orderStatus: 'Delivered',
      isDelivered: true,
      deliveredAt: expect.any(Date),
    });
  });
});

describe('recordPayment', () => {
  const payment = {
    actorId: null,
    paymentResult: { id: 'pi_1', status: 'succeeded', email_address: '', pricePaid: '10.00' },
  };

  it('moves a fresh paid order into Processing, logging Paid then Processing', async () => {
    orderIn('Pending');
    expect(await recordPayment(fakeTx, 'order-1', payment)).toBe(true);

    expect(tx.orderEvent.create.mock.calls.map((c) => c[0].data.type)).toEqual([
      'Paid',
      'Processing',
    ]);
  });

  it('is a no-op on an order that is already paid or cancelled', async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    expect(await recordPayment(fakeTx, 'order-1', payment)).toBe(false);
    expect(tx.order.updateMany.mock.calls[0][0].where).toEqual({
      id: 'order-1',
      isPaid: false,
      orderStatus: { not: 'Cancelled' },
    });
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });
});

describe('admin delivery rules', () => {
  it('ORD-09: deliverOrder refuses an unpaid order', async () => {
    orderIn('Shipped', { isPaid: false });
    const res = await deliverOrder('order-1');
    expect(res).toEqual({ success: false, message: 'Order is not paid' });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  // Regression: the status dropdown used to skip the "must be paid" rule that
  // deliverOrder enforced, so a cash-on-delivery order could be Delivered unpaid.
  it('ORD-10: updateOrderStatus also refuses to deliver an unpaid order', async () => {
    orderIn('Shipped', { isPaid: false });
    const res = await updateOrderStatus('order-1', 'Delivered');
    expect(res).toEqual({ success: false, message: 'Order is not paid' });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('both paths deliver a paid order', async () => {
    orderIn('Shipped', { isPaid: true });
    expect((await deliverOrder('order-1')).success).toBe(true);
    expect((await updateOrderStatus('order-1', 'Delivered')).success).toBe(true);
  });
});
