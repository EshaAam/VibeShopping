'use server';

import { stripe } from '@/lib/stripe';
import { formatError } from '@/lib/utils';
import { requireOrderOwner } from '@/lib/auth-guard';
import { markOrderPaid } from '@/lib/payments';

// Create Stripe Payment Intent for an order
export async function createStripePaymentIntent(orderId: string) {
  try {
    const { order } = await requireOrderOwner(orderId, { allowAdmin: false });

    if (order.isPaid) {
      throw new Error('Order is already paid');
    }
    if (order.orderStatus === 'Cancelled') {
      throw new Error('This order has been cancelled');
    }

    // Convert totalPrice to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(Number(order.totalPrice) * 100);

    // The idempotency key makes reloads and double clicks return the same
    // intent instead of piling up new ones - fewer chances to charge twice.
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          orderId: order.id,
          userId: order.userId,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      },
      { idempotencyKey: `order-${order.id}-${amountInCents}` }
    );

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Confirm Stripe payment right after the card succeeds in the browser. The
// webhook would get there too; this just updates the order without waiting.
export async function confirmStripePayment(
  orderId: string,
  paymentIntentId: string
) {
  try {
    await requireOrderOwner(orderId, { allowAdmin: false });

    // Verify the payment intent with Stripe rather than trusting the client
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Block replaying a cheap intent against a different order
    if (paymentIntent.metadata.orderId !== orderId) {
      throw new Error('Payment intent does not match order');
    }

    const result = await markOrderPaid(paymentIntent);
    if (result.status === 'rejected') throw new Error(result.reason);

    return {
      success: true,
      message:
        result.status === 'paid'
          ? 'Payment successful! Your order is being processed.'
          : 'Order already paid',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}
