/**
 * Guarantees that live in the database itself, not in app code: they hold
 * even for a raw SQL session, a script, or a future code path that forgets.
 * Only a real Postgres can show a trigger or CHECK constraint firing.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../helpers/db';
import { setupTestDatabase } from '../helpers/db';
import { makeProduct, makeUser } from '../helpers/factories';

setupTestDatabase();

let orderId: string;
let productId: string;
let userId: string;

beforeEach(async () => {
  const user = await makeUser();
  const product = await makeProduct();
  userId = user.id;
  productId = product.id;

  const order = await prisma.order.create({
    data: {
      userId,
      shippingAddress: { city: 'Dhaka' },
      paymentMethod: 'Stripe',
      itemsPrice: '40.00',
      shippingPrice: '10.00',
      taxPrice: '6.00',
      totalPrice: '56.00',
      orderItems: {
        create: { productId, qty: 1, price: '40.00', name: product.name, slug: product.slug, image: '/x.jpg' },
      },
      events: { create: { type: 'Created', actorId: userId } },
    },
  });
  orderId = order.id;
});

describe('order history is append-only', () => {
  it('DB-01: an order event cannot be edited', async () => {
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "OrderEvent" SET type = 'Paid' WHERE "orderId" = '${orderId}'`)
    ).rejects.toThrow(/append-only/);
  });

  it('DB-01: an order event cannot be deleted', async () => {
    await expect(prisma.orderEvent.deleteMany({ where: { orderId } })).rejects.toThrow(/append-only/);
    expect(await prisma.orderEvent.count({ where: { orderId } })).toBe(1);
  });

  it('DB-01: new events can still be appended', async () => {
    await prisma.orderEvent.create({ data: { orderId, type: 'Cancelled', actorId: userId } });
    expect(await prisma.orderEvent.count({ where: { orderId } })).toBe(2);
  });

  it('DB-02: an order cannot be deleted, even with raw SQL', async () => {
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "Order" WHERE id = '${orderId}'`)
    ).rejects.toThrow(/Orders cannot be deleted/);
    expect(await prisma.order.count()).toBe(1);
  });
});

describe('order flags agree with each other', () => {
  it('DB-03: paid without a payment time is rejected', async () => {
    await expect(
      prisma.order.update({ where: { id: orderId }, data: { isPaid: true } })
    ).rejects.toThrow(/order_paid_consistent/);
  });

  it('DB-03: a payment time on an unpaid order is rejected', async () => {
    await expect(
      prisma.order.update({ where: { id: orderId }, data: { paidAt: new Date() } })
    ).rejects.toThrow(/order_paid_consistent/);
  });

  it('DB-04: "delivered" must match the Delivered status and a delivery time', async () => {
    await expect(
      prisma.order.update({
        where: { id: orderId },
        data: { orderStatus: 'Shipped', isDelivered: true, deliveredAt: new Date() },
      })
    ).rejects.toThrow(/order_delivered_consistent/);

    await expect(
      prisma.order.update({ where: { id: orderId }, data: { orderStatus: 'Delivered' } })
    ).rejects.toThrow(/order_delivered_consistent/);
  });

  it('a consistent update is accepted', async () => {
    await prisma.order.update({
      where: { id: orderId },
      data: { isPaid: true, paidAt: new Date(), orderStatus: 'Delivered', isDelivered: true, deliveredAt: new Date() },
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).isDelivered).toBe(true);
  });

  it('the status column only accepts known statuses', async () => {
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "Order" SET "orderStatus" = 'Shipppped' WHERE id = '${orderId}'`)
    ).rejects.toThrow(/invalid input value for enum/);
  });
});

describe('history keeps its references', () => {
  it('DB-05: a product that was ordered cannot be deleted', async () => {
    await expect(prisma.product.delete({ where: { id: productId } })).rejects.toThrow();
    expect(await prisma.product.count({ where: { id: productId } })).toBe(1);
  });

  it('DB-06: a customer with orders cannot be deleted', async () => {
    await expect(prisma.user.delete({ where: { id: userId } })).rejects.toThrow();
    expect(await prisma.user.count({ where: { id: userId } })).toBe(1);
  });

  it('a product nobody ordered can be deleted', async () => {
    const unsold = await makeProduct();
    await prisma.product.delete({ where: { id: unsold.id } });
    expect(await prisma.product.count({ where: { id: unsold.id } })).toBe(0);
  });
});
