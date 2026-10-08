import 'server-only';

import type Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/db/prisma';
import { recordPayment } from '@/lib/orders';

export type MarkPaidResult =
  | { status: 'paid' | 'already-paid'; orderId: string }
  | { status: 'rejected'; reason: string };

// The single place an order becomes paid through Stripe. Both the webhook (the
// source of truth) and the client-side confirm (a fast path so the customer
// sees "paid" immediately) call this, so the checks can't drift apart.
//
// Idempotent: recordPayment only matches while isPaid is still false, so webhook
// retries, duplicate events and the confirm racing the webhook all collapse
// into one write.
export async function markOrderPaid(
  intent: Stripe.PaymentIntent
): Promise<MarkPaidResult> {
  if (intent.status !== 'succeeded') {
    return { status: 'rejected', reason: 'Payment not successful' };
  }

  const orderId = intent.metadata?.orderId;
  if (!orderId) {
    return { status: 'rejected', reason: 'Payment intent has no order id' };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { email: true } } },
  });
  if (!order) return { status: 'rejected', reason: 'Order not found' };

  // Never trust that the intent was created for this order's current total.
  const expected = Math.round(Number(order.totalPrice) * 100);
  if (intent.amount_received !== expected || intent.currency !== 'usd') {
    return {
      status: 'rejected',
      reason: 'Paid amount does not match the order total',
    };
  }

  if (order.orderStatus === 'Cancelled') {
    // Money moved for an order that no longer exists - needs a refund, not a
    // status change that would resurrect it.
    console.error(
      `[payments] intent ${intent.id} succeeded for cancelled order ${orderId}, refund required`
    );
    return { status: 'rejected', reason: 'Order was cancelled' };
  }

  // Paid by the system (Stripe), not by a signed-in user
  const paid = await prisma.$transaction((tx) =>
    recordPayment(tx, orderId, {
      actorId: null,
      paymentResult: {
        id: intent.id,
        status: intent.status,
        email_address: order.user.email,
        pricePaid: (intent.amount_received / 100).toFixed(2),
      },
    })
  );

  revalidatePath(`/order/${orderId}`);

  return { status: paid ? 'paid' : 'already-paid', orderId };
}
