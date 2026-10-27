/**
 * The two Stripe actions a customer's browser calls. Only the order's owner
 * may start or confirm a payment, a reload must not create a second
 * PaymentIntent, and a cheap intent from one order can't pay for another.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, userFindUnique, orderFindUnique, intentsCreate, intentsRetrieve, markOrderPaid } =
  vi.hoisted(() => ({
    auth: vi.fn(),
    userFindUnique: vi.fn(),
    orderFindUnique: vi.fn(),
    intentsCreate: vi.fn(),
    intentsRetrieve: vi.fn(),
    markOrderPaid: vi.fn(),
  }));

vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth }));
vi.mock('@/db/prisma', () => ({
  prisma: { user: { findUnique: userFindUnique }, order: { findUnique: orderFindUnique } },
}));
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: intentsCreate, retrieve: intentsRetrieve } },
}));
vi.mock('@/lib/payments', () => ({ markOrderPaid }));

import { confirmStripePayment, createStripePaymentIntent } from '@/lib/actions/payment.actions';

function signedInAs(id: string, role: 'user' | 'admin' = 'user') {
  auth.mockResolvedValue({ user: { id, role } });
  userFindUnique.mockResolvedValue({ role });
}

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  userId: 'user-1',
  totalPrice: '12.34',
  isPaid: false,
  orderStatus: 'Pending',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs('user-1');
  orderFindUnique.mockResolvedValue(order());
  intentsCreate.mockResolvedValue({ id: 'pi_1', client_secret: 'secret_1' });
});

describe('createStripePaymentIntent', () => {
  it('charges the order total in cents and tags the intent with the order', async () => {
    const res = await createStripePaymentIntent('order-1');

    expect(res).toEqual({ success: true, clientSecret: 'secret_1', paymentIntentId: 'pi_1' });
    expect(intentsCreate.mock.calls[0][0]).toMatchObject({
      amount: 1234,
      currency: 'usd',
      metadata: { orderId: 'order-1', userId: 'user-1' },
    });
  });

  it('PAY-14: a reload sends the same idempotency key, so Stripe returns the same intent', async () => {
    await createStripePaymentIntent('order-1');
    await createStripePaymentIntent('order-1');

    expect(intentsCreate.mock.calls[0][1]).toEqual({ idempotencyKey: 'order-order-1-1234' });
    expect(intentsCreate.mock.calls[1][1]).toEqual(intentsCreate.mock.calls[0][1]);
  });

  it('refuses an order that is already paid or cancelled', async () => {
    orderFindUnique.mockResolvedValue(order({ isPaid: true }));
    expect(await createStripePaymentIntent('order-1')).toEqual({
      success: false,
      message: 'Order is already paid',
    });

    orderFindUnique.mockResolvedValue(order({ orderStatus: 'Cancelled' }));
    expect(await createStripePaymentIntent('order-1')).toEqual({
      success: false,
      message: 'This order has been cancelled',
    });
    expect(intentsCreate).not.toHaveBeenCalled();
  });

  it("refuses another customer's order as if it did not exist", async () => {
    signedInAs('user-2');

    expect(await createStripePaymentIntent('order-1')).toEqual({
      success: false,
      message: 'Order not found',
    });
    expect(intentsCreate).not.toHaveBeenCalled();
  });

  it("PAY-15: an admin can't start a payment on a customer's order either", async () => {
    signedInAs('admin-1', 'admin');

    expect(await createStripePaymentIntent('order-1')).toEqual({
      success: false,
      message: 'Order not found',
    });
    expect(intentsCreate).not.toHaveBeenCalled();
  });
});

describe('confirmStripePayment', () => {
  it('PAY-08: refuses an intent that was created for a different order', async () => {
    intentsRetrieve.mockResolvedValue({ id: 'pi_cheap', metadata: { orderId: 'order-cheap' } });

    expect(await confirmStripePayment('order-1', 'pi_cheap')).toEqual({
      success: false,
      message: 'Payment intent does not match order',
    });
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it('checks the intent with Stripe, not the browser, then marks the order paid', async () => {
    const intent = { id: 'pi_1', metadata: { orderId: 'order-1' } };
    intentsRetrieve.mockResolvedValue(intent);
    markOrderPaid.mockResolvedValue({ status: 'paid', orderId: 'order-1' });

    const res = await confirmStripePayment('order-1', 'pi_1');

    expect(intentsRetrieve).toHaveBeenCalledWith('pi_1');
    expect(markOrderPaid).toHaveBeenCalledWith(intent);
    expect(res).toEqual({
      success: true,
      message: 'Payment successful! Your order is being processed.',
    });
  });

  it('is calm when the webhook already marked it paid', async () => {
    intentsRetrieve.mockResolvedValue({ id: 'pi_1', metadata: { orderId: 'order-1' } });
    markOrderPaid.mockResolvedValue({ status: 'already-paid', orderId: 'order-1' });

    expect(await confirmStripePayment('order-1', 'pi_1')).toEqual({
      success: true,
      message: 'Order already paid',
    });
  });

  it('passes on the reason when markOrderPaid rejects the payment', async () => {
    intentsRetrieve.mockResolvedValue({ id: 'pi_1', metadata: { orderId: 'order-1' } });
    markOrderPaid.mockResolvedValue({ status: 'rejected', reason: 'Paid amount does not match the order total' });

    expect(await confirmStripePayment('order-1', 'pi_1')).toEqual({
      success: false,
      message: 'Paid amount does not match the order total',
    });
  });

  it("refuses another customer's order before asking Stripe anything", async () => {
    signedInAs('user-2');

    expect(await confirmStripePayment('order-1', 'pi_1')).toEqual({
      success: false,
      message: 'Order not found',
    });
    expect(intentsRetrieve).not.toHaveBeenCalled();
  });
});
