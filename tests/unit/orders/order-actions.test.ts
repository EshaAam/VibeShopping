/**
 * The order actions customers and admins call: placing an order, cancelling,
 * and marking a cash order paid. Who may do what is decided here, and checkout
 * re-prices every line from the database inside the transaction.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const tx = {
    product: { findUnique: vi.fn(), updateMany: vi.fn() },
    orderItem: { createMany: vi.fn() },
    cart: { updateMany: vi.fn() },
  };
  return {
    tx,
    auth: vi.fn(),
    liveRole: { value: 'user' },
    orderFindUnique: vi.fn(),
    orderFindFirst: vi.fn(),
    refundsCreate: vi.fn(),
    getMyCart: vi.fn(),
    getUserById: vi.fn(),
    transitionOrder: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
    recordPayment: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
    createOrderRecord: vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(async () => ({
      id: 'order-9',
    })),
  };
});

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/auth', () => ({ auth: h.auth }));
vi.mock('@/db/prisma', () => ({
  prisma: {
    user: { findUnique: async () => ({ role: h.liveRole.value }) },
    order: { findUnique: h.orderFindUnique, findFirst: h.orderFindFirst },
    $transaction: (fn: (tx: unknown) => unknown) => fn(h.tx),
  },
}));
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: h.refundsCreate } } }));
vi.mock('@/lib/data/cart', () => ({ getMyCart: h.getMyCart }));
vi.mock('@/lib/data/user', () => ({ getUserById: h.getUserById }));
vi.mock('@/lib/data/order', () => ({ getSalesChartData: vi.fn() }));
vi.mock('@/lib/orders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/orders')>()),
  transitionOrder: h.transitionOrder,
  recordPayment: h.recordPayment,
  createOrderRecord: h.createOrderRecord,
}));

import { cancelOrder, createOrder, placeOrder, updateOrderToPaid } from '@/lib/actions/order.actions';

function signedInAs(id: string, role: 'user' | 'admin' = 'user') {
  h.auth.mockResolvedValue({ user: { id, role } });
  h.liveRole.value = role;
}

const order = (overrides: Record<string, unknown> = {}) => {
  const value = {
    id: 'order-1',
    userId: 'user-1',
    orderStatus: 'Pending',
    isPaid: false,
    paymentMethod: 'Stripe',
    paymentResult: null as unknown,
    totalPrice: '12.34',
    ...overrides,
  };
  h.orderFindUnique.mockResolvedValue(value);
  h.orderFindFirst.mockResolvedValue(value);
  return value;
};

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs('user-1');
  h.recordPayment.mockResolvedValue(true);
});

describe('cancelOrder', () => {
  it("ORD-07: another customer's order looks like it doesn't exist", async () => {
    order({ userId: 'user-1' });
    signedInAs('user-2');

    expect(await cancelOrder('order-1')).toEqual({ success: false, message: 'Order not found' });
    expect(h.transitionOrder).not.toHaveBeenCalled();
  });

  it('a customer can cancel their own unpaid order', async () => {
    order();

    const res = await cancelOrder('order-1');

    expect(res).toEqual({ success: true, message: 'Order has been cancelled successfully' });
    expect(h.transitionOrder).toHaveBeenCalledWith(h.tx, 'order-1', 'Cancelled', {
      actorId: 'user-1',
      eventData: undefined,
    });
  });

  it('ORD-06: a customer cannot cancel their own paid order', async () => {
    order({ isPaid: true, orderStatus: 'Processing', paymentResult: { id: 'pi_1' } });

    const res = await cancelOrder('order-1');

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already been paid/);
    expect(h.refundsCreate).not.toHaveBeenCalled();
    expect(h.transitionOrder).not.toHaveBeenCalled();
  });

  it('a shipped order can no longer be cancelled', async () => {
    order({ orderStatus: 'Shipped' });

    const res = await cancelOrder('order-1');

    expect(res.message).toMatch(/already been shipped/);
    expect(h.transitionOrder).not.toHaveBeenCalled();
  });

  it("ORD-06: an admin cancelling a customer's paid order refunds it first", async () => {
    order({ isPaid: true, orderStatus: 'Processing', paymentResult: { id: 'pi_1' } });
    signedInAs('admin-1', 'admin');
    h.refundsCreate.mockResolvedValue({ id: 're_1', amount: 1234, status: 'succeeded' });

    const res = await cancelOrder('order-1');

    expect(res).toEqual({
      success: true,
      message: 'Order cancelled and $12.34 refunded to the customer',
    });
    expect(h.refundsCreate).toHaveBeenCalledTimes(1);
    expect(h.transitionOrder.mock.calls[0][3]).toMatchObject({
      actorId: 'admin-1',
      eventData: { refund: { refundId: 're_1', amount: '12.34' } },
    });
  });
});

describe('updateOrderToPaid (cash on delivery)', () => {
  beforeEach(() => signedInAs('admin-1', 'admin'));

  it('ORD-08: refuses an order that is already paid', async () => {
    order({ isPaid: true });
    expect(await updateOrderToPaid('order-1')).toEqual({
      success: false,
      message: 'Order is already paid',
    });
    expect(h.recordPayment).not.toHaveBeenCalled();
  });

  it('ORD-08: refuses a cancelled order', async () => {
    order({ orderStatus: 'Cancelled' });
    expect(await updateOrderToPaid('order-1')).toEqual({
      success: false,
      message: 'Cannot mark a cancelled order as paid',
    });
    expect(h.recordPayment).not.toHaveBeenCalled();
  });

  it('records the payment against the admin who took the cash', async () => {
    order({ paymentMethod: 'CashOnDelivery' });

    expect((await updateOrderToPaid('order-1')).success).toBe(true);
    expect(h.recordPayment).toHaveBeenCalledWith(h.tx, 'order-1', {
      actorId: 'admin-1',
      paymentResult: expect.objectContaining({
        id: expect.stringMatching(/^COD_/),
        pricePaid: '12.34',
      }),
    });
  });

  it('ORD-08: losing a race to another payment is reported, not hidden', async () => {
    order({ paymentMethod: 'CashOnDelivery' });
    h.recordPayment.mockResolvedValue(false);

    expect(await updateOrderToPaid('order-1')).toEqual({
      success: false,
      message: 'Order is already paid or was cancelled',
    });
  });
});

describe('createOrder', () => {
  const address = {
    fullName: 'Test User',
    streetAddress: '1 Main Street',
    city: 'Dhaka',
    postalCode: '1212',
    country: 'Bangladesh',
  };
  const user = { id: 'user-1', address, paymentMethod: 'Stripe' };
  const cartLine = { productId: 'p1', name: 'Laptop', slug: 'laptop', image: 'x.jpg', price: '0.01', qty: 1 };
  const laptop = {
    id: 'p1',
    name: 'Laptop',
    slug: 'laptop',
    images: ['laptop.jpg'],
    price: '1400.00',
    archivedAt: null,
  };

  beforeEach(() => {
    h.getUserById.mockResolvedValue(user);
    h.getMyCart.mockResolvedValue({ id: 'cart-1', version: 3, items: [cartLine] });
    h.tx.cart.updateMany.mockResolvedValue({ count: 1 });
    h.tx.product.findUnique.mockResolvedValue(laptop);
    h.tx.product.updateMany.mockResolvedValue({ count: 1 });
  });

  it('refuses a signed-out caller', async () => {
    h.auth.mockResolvedValue(null);
    expect(await createOrder()).toEqual({ success: false, message: 'User is not authenticated' });
  });

  it.each([
    ['an empty cart', () => h.getMyCart.mockResolvedValue({ id: 'cart-1', items: [] }), '/cart'],
    ['no address', () => h.getUserById.mockResolvedValue({ ...user, address: null }), '/shipping-address'],
    ['no payment method', () => h.getUserById.mockResolvedValue({ ...user, paymentMethod: null }), '/payment-method'],
  ])('CHK-01: %s sends the customer back to that step', async (_, setup, redirectTo) => {
    setup();
    const res = await createOrder();
    expect(res).toMatchObject({ success: false, redirectTo });
    expect(h.createOrderRecord).not.toHaveBeenCalled();
  });

  it('CHK-02: re-prices every line from the database, whatever the cart says', async () => {
    const res = await createOrder();

    expect(res).toEqual({
      success: true,
      message: 'Order successfully created',
      redirectTo: '/order/order-9',
    });
    expect(h.tx.orderItem.createMany.mock.calls[0][0].data).toEqual([
      { productId: 'p1', name: 'Laptop', slug: 'laptop', image: 'laptop.jpg', price: '1400.00', qty: 1, orderId: 'order-9' },
    ]);
    expect(h.createOrderRecord.mock.calls[0][1]).toMatchObject({
      itemsPrice: '1400.00',
      totalPrice: '1610.00',
    });
  });

  it('claims the cart at the version it read, then reserves stock with a conditional decrement', async () => {
    await createOrder();

    expect(h.tx.cart.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'cart-1', version: 3 },
      data: { items: [], version: { increment: 1 } },
    });
    expect(h.tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', stock: { gte: 1 } },
      data: { stock: { decrement: 1 } },
    });
  });

  it('CHK-07: a second click that lost the cart claim places nothing', async () => {
    h.tx.cart.updateMany.mockResolvedValue({ count: 0 });

    const res = await createOrder();

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/cart changed/);
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();
    expect(h.createOrderRecord).not.toHaveBeenCalled();
  });

  it('stops before creating the order when the stock is gone', async () => {
    h.tx.product.updateMany.mockResolvedValue({ count: 0 });

    expect(await createOrder()).toEqual({
      success: false,
      message: 'Not enough stock for Laptop',
    });
    // The transaction throws, so the cart claim above it rolls back too
    expect(h.createOrderRecord).not.toHaveBeenCalled();
  });

  it('CHK-05: refuses a product archived since it went in the cart', async () => {
    h.tx.product.findUnique.mockResolvedValue({ ...laptop, archivedAt: new Date() });

    expect(await createOrder()).toEqual({
      success: false,
      message: 'Laptop is no longer available',
    });
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();
  });

  // The "Place Order" button. Navigating from the server avoids a client
  // router.push() that Next.js 15 can drop while the action settles.
  describe('placeOrder', () => {
    /** next/navigation's redirect() throws; its digest carries the target. */
    const redirectsTo = (path: string) =>
      expect.objectContaining({ digest: expect.stringContaining(`;${path};`) });

    it('redirects to the new order', async () => {
      await expect(placeOrder()).rejects.toEqual(redirectsTo('/order/order-9'));
    });

    it('redirects back to the checkout step that is missing', async () => {
      h.getMyCart.mockResolvedValue({ id: 'cart-1', version: 3, items: [] });
      await expect(placeOrder()).rejects.toEqual(redirectsTo('/cart'));
    });

    it('returns the error, without navigating, when the order cannot be placed', async () => {
      h.tx.product.updateMany.mockResolvedValue({ count: 0 });
      expect(await placeOrder()).toEqual({ success: false, message: 'Not enough stock for Laptop' });
    });
  });
});
