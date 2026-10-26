import 'server-only';

import type { OrderEventType, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';

// The only module that writes Order rows. Every change appends an OrderEvent
// in the same transaction, so the event log is the history and the columns on
// Order (orderStatus, isPaid, isDelivered, ...) are a projection of it. A test
// fails if order writes appear anywhere else.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Allowed fulfilment moves. Payment is a separate axis (see recordPayment). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

export async function createOrderRecord(
  tx: Tx,
  data: Prisma.OrderUncheckedCreateInput,
  actorId: string
) {
  const order = await tx.order.create({ data });
  await tx.orderEvent.create({
    data: { orderId: order.id, type: 'Created', actorId },
  });
  return order;
}

/**
 * Move an order to a new status. The update is conditional on the status we
 * validated against, so two admins acting at once can't both succeed.
 * Cancelling puts the order's items back in stock.
 */
export async function transitionOrder(
  tx: Tx,
  orderId: string,
  to: Exclude<OrderStatus, 'Pending'>,
  {
    actorId,
    trackingNumber,
    eventData,
  }: {
    actorId: string | null;
    trackingNumber?: string;
    /** Extra details stored on the history row, e.g. the refund. */
    eventData?: Prisma.InputJsonObject;
  }
) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');

  const from = order.orderStatus;
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw new Error(`Cannot change status from ${from} to ${to}`);
  }

  const updated = await tx.order.updateMany({
    where: { id: orderId, orderStatus: from },
    data: {
      orderStatus: to,
      ...(to === 'Shipped' && trackingNumber ? { trackingNumber } : {}),
      ...(to === 'Delivered' ? { isDelivered: true, deliveredAt: new Date() } : {}),
    },
  });
  if (updated.count === 0) {
    throw new Error('Order status changed, please refresh and try again');
  }

  if (to === 'Cancelled') {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.qty } },
      });
    }
  }

  await tx.orderEvent.create({
    data: {
      orderId,
      type: to as OrderEventType,
      actorId,
      data:
        trackingNumber || eventData
          ? { ...eventData, ...(trackingNumber ? { trackingNumber } : {}) }
          : undefined,
    },
  });
}

/**
 * Record a payment. Returns false if the order was already paid or has been
 * cancelled - callers treat that as "nothing to do", which is what makes
 * webhook retries safe. A fresh order moves into Processing once paid.
 */
export async function recordPayment(
  tx: Tx,
  orderId: string,
  {
    actorId,
    paymentResult,
  }: {
    actorId: string | null;
    paymentResult: { id: string; status: string; email_address: string; pricePaid: string };
  }
) {
  const updated = await tx.order.updateMany({
    where: { id: orderId, isPaid: false, orderStatus: { not: 'Cancelled' } },
    data: { isPaid: true, paidAt: new Date(), paymentResult },
  });
  if (updated.count === 0) return false;

  await tx.orderEvent.create({
    data: {
      orderId,
      type: 'Paid',
      actorId,
      data: { paymentId: paymentResult.id, amount: paymentResult.pricePaid },
    },
  });

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { orderStatus: true },
  });
  if (order?.orderStatus === 'Pending') {
    await transitionOrder(tx, orderId, 'Processing', { actorId });
  }

  return true;
}
