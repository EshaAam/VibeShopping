/**
 * An order's life after checkout, against a real Postgres: payment arriving
 * twice or from two places at once, admins acting at the same moment, and
 * cancelling. The invariant every test checks: the event log tells exactly
 * what happened, once.
 */
import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

vi.mock('@/auth', async () => ({ auth: (await import('../helpers/request')).auth }));

import { cancelOrder, createOrder, updateOrderStatus } from '@/lib/actions/order.actions';
import { markOrderPaid } from '@/lib/payments';
import { prisma, setupTestDatabase } from '../helpers/db';
import { lineFor, makeCart, makeProduct, makeUser, orderState } from '../helpers/factories';
import { as, signedIn } from '../helpers/request';

setupTestDatabase();

async function placeOrder(lines: { stock?: number; qty: number }[] = [{ qty: 1 }]) {
  const user = await makeUser();
  const products = await Promise.all(lines.map((l) => makeProduct({ stock: l.stock ?? 10 })));
  await makeCart({ userId: user.id }, products.map((p, i) => lineFor(p, lines[i].qty)));
  const res = await as(signedIn(user), createOrder);
  if (!res.success) throw new Error(res.message);
  const order = await prisma.order.findFirstOrThrow({ where: { userId: user.id } });
  return { user, products, order };
}

function succeededIntent(order: { id: string; totalPrice: { toString(): string } }) {
  return {
    id: `pi_${order.id.slice(0, 8)}`,
    status: 'succeeded',
    amount_received: Math.round(Number(order.totalPrice.toString()) * 100),
    currency: 'usd',
    metadata: { orderId: order.id },
  } as unknown as Stripe.PaymentIntent;
}

async function makeAdmin() {
  const admin = await makeUser({ role: 'admin' });
  return signedIn({ id: admin.id, role: 'admin' });
}

describe('payment', () => {
  it('PAY-07: a paid order moves to Processing, logged as Paid then Processing', async () => {
    const { order } = await placeOrder();

    expect(await markOrderPaid(succeededIntent(order))).toEqual({ status: 'paid', orderId: order.id });

    const state = await orderState(order.id);
    expect(state).toMatchObject({ isPaid: true, orderStatus: 'Processing' });
    expect(state.paidAt).toBeInstanceOf(Date);
    expect(state.events).toEqual(['Created', 'Paid', 'Processing']);
  });

  it('PAY-05: the same Stripe event delivered twice is recorded once', async () => {
    const { order } = await placeOrder();
    const intent = succeededIntent(order);

    expect((await markOrderPaid(intent)).status).toBe('paid');
    expect((await markOrderPaid(intent)).status).toBe('already-paid');

    expect((await orderState(order.id)).events).toEqual(['Created', 'Paid', 'Processing']);
  });

  it('PAY-06: the webhook and the browser confirming at the same moment record one payment', async () => {
    const { order } = await placeOrder();
    const intent = succeededIntent(order);

    const results = await Promise.all([markOrderPaid(intent), markOrderPaid(intent)]);

    expect(results.map((r) => r.status).sort()).toEqual(['already-paid', 'paid']);
    const events = (await orderState(order.id)).events;
    expect(events.filter((e) => e === 'Paid')).toHaveLength(1);
    expect(events.filter((e) => e === 'Processing')).toHaveLength(1);
  });
});

describe('fulfilment', () => {
  it('ORD-03: two admins shipping the same order at once - one wins, one event', async () => {
    const { order } = await placeOrder();
    await markOrderPaid(succeededIntent(order));
    const [first, second] = [await makeAdmin(), await makeAdmin()];

    const results = await Promise.all([
      as(first, () => updateOrderStatus(order.id, 'Shipped', 'TRK-1')),
      as(second, () => updateOrderStatus(order.id, 'Shipped', 'TRK-2')),
    ]);

    expect(results.filter((r) => r.success)).toHaveLength(1);
    const state = await orderState(order.id);
    expect(state.orderStatus).toBe('Shipped');
    expect(state.events.filter((e) => e === 'Shipped')).toHaveLength(1);
  });

  it('a full happy path leaves a complete, ordered history', async () => {
    const { order } = await placeOrder();
    const admin = await makeAdmin();
    await markOrderPaid(succeededIntent(order));

    await as(admin, () => updateOrderStatus(order.id, 'Shipped', 'TRK-9'));
    await as(admin, () => updateOrderStatus(order.id, 'Delivered'));

    const state = await orderState(order.id);
    expect(state).toMatchObject({ orderStatus: 'Delivered', isDelivered: true, trackingNumber: 'TRK-9' });
    expect(state.events).toEqual(['Created', 'Paid', 'Processing', 'Shipped', 'Delivered']);
  });

  it('ORD-10: an unpaid order cannot be delivered (the database row stays Shipped)', async () => {
    const { order } = await placeOrder();
    const admin = await makeAdmin();
    await as(admin, () => updateOrderStatus(order.id, 'Processing'));
    await as(admin, () => updateOrderStatus(order.id, 'Shipped'));

    const res = await as(admin, () => updateOrderStatus(order.id, 'Delivered'));

    expect(res).toEqual({ success: false, message: 'Order is not paid' });
    expect((await orderState(order.id)).orderStatus).toBe('Shipped');
  });
});

describe('cancelling', () => {
  it('ORD-04: cancelling puts every line back in stock and logs it', async () => {
    const { user, products, order } = await placeOrder([
      { stock: 10, qty: 3 },
      { stock: 4, qty: 4 },
    ]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: products[1].id } })).stock).toBe(0);

    const res = await as(signedIn(user), () => cancelOrder(order.id));

    expect(res.success).toBe(true);
    const stock = await Promise.all(
      products.map(async (p) => (await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock)
    );
    expect(stock).toEqual([10, 4]);
    expect((await orderState(order.id)).events).toEqual(['Created', 'Cancelled']);
  });

  it('a payment that arrives after the order was cancelled does not revive it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user, order } = await placeOrder();
    await as(signedIn(user), () => cancelOrder(order.id));

    const res = await markOrderPaid(succeededIntent(order));

    expect(res).toEqual({ status: 'rejected', reason: 'Order was cancelled' });
    const state = await orderState(order.id);
    expect(state).toMatchObject({ orderStatus: 'Cancelled', isPaid: false });
    expect(state.events).toEqual(['Created', 'Cancelled']);
  });
});
