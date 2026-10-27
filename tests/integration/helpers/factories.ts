import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';

const address = {
  fullName: 'Test Customer',
  streetAddress: '1 Main Street',
  city: 'Dhaka',
  postalCode: '1212',
  country: 'Bangladesh',
};

export async function makeUser(overrides: Partial<Prisma.UserCreateInput> = {}) {
  const id = randomUUID().slice(0, 8);
  return prisma.user.create({
    data: {
      name: `Customer ${id}`,
      email: `customer-${id}@test.io`,
      role: 'user',
      address,
      paymentMethod: 'Stripe',
      ...overrides,
    },
  });
}

export async function makeProduct(overrides: Partial<Prisma.ProductCreateInput> = {}) {
  const id = randomUUID().slice(0, 8);
  return prisma.product.create({
    data: {
      name: `Product ${id}`,
      slug: `product-${id}`,
      category: 'Lighting',
      brand: 'Lumen',
      description: 'A test product',
      images: [`/${id}.jpg`],
      price: '40.00',
      stock: 10,
      ...overrides,
    },
  });
}

/** A cart line as the app stores it, priced from the product row. */
export function lineFor(product: { id: string; name: string; slug: string; images: string[]; price: unknown }, qty = 1) {
  return {
    productId: product.id,
    name: product.name,
    slug: product.slug,
    image: product.images[0],
    price: String(product.price),
    qty,
  };
}

export async function makeCart(
  owner: { userId?: string; sessionCartId?: string },
  lines: ReturnType<typeof lineFor>[]
) {
  return prisma.cart.create({
    data: {
      userId: owner.userId ?? null,
      sessionCartId: owner.sessionCartId ?? `cart-${randomUUID()}`,
      items: lines,
      itemsPrice: '0.00',
      shippingPrice: '0.00',
      taxPrice: '0.00',
      totalPrice: '0.00',
    },
  });
}

/** Rows that tell the story of an order: its status and its event history. */
export async function orderState(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const events = await prisma.orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
  });
  return { ...order, events: events.map((e) => e.type) };
}
