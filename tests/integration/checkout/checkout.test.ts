/**
 * Checkout and cart writes against a real Postgres: the transaction, the
 * conditional stock decrement and the cart version only prove themselves when
 * real rows are locked and real transactions roll back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const barrier = vi.hoisted(() => ({ wait: async () => {} }));

vi.mock('@/auth', async () => ({ auth: (await import('../helpers/request')).auth }));
// The cart read is where two clicks can see the same state; the barrier makes
// both requests read before either writes.
vi.mock('@/lib/data/cart', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/cart')>();
  return {
    ...real,
    getMyCart: async () => {
      const cart = await real.getMyCart();
      await barrier.wait();
      return cart;
    },
  };
});

import { addItemToCart } from '@/lib/actions/cart.actions';
import { createOrder } from '@/lib/actions/order.actions';
import { createBarrier } from '../helpers/barrier';
import { prisma, setupTestDatabase } from '../helpers/db';
import { lineFor, makeCart, makeProduct, makeUser } from '../helpers/factories';
import { as, guest, signedIn } from '../helpers/request';

setupTestDatabase();

const race = createBarrier();
barrier.wait = race.wait;
afterEach(() => race.disarm());

const stockOf = async (id: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;

describe('createOrder', () => {
  it('CHK-06: one transaction writes the order, its lines, its first event, the stock and the cart', async () => {
    const user = await makeUser();
    const lamp = await makeProduct({ price: '40.00', stock: 5 });
    const desk = await makeProduct({ price: '120.00', stock: 2 });
    await makeCart({ userId: user.id }, [lineFor(lamp, 2), lineFor(desk, 1)]);

    const res = await as(signedIn(user), createOrder);

    expect(res.success).toBe(true);
    const order = await prisma.order.findFirstOrThrow({
      where: { userId: user.id },
      include: { orderItems: true, events: true },
    });
    expect(order).toMatchObject({ orderStatus: 'Pending', isPaid: false });
    expect(order.itemsPrice.toString()).toBe('200');
    expect(order.totalPrice.toString()).toBe('230'); // 200 + 0 shipping + 30 tax
    expect(order.orderItems).toHaveLength(2);
    expect(order.events.map((e) => e.type)).toEqual(['Created']);
    expect(await stockOf(lamp.id)).toBe(3);
    expect(await stockOf(desk.id)).toBe(1);
    expect((await prisma.cart.findFirstOrThrow({ where: { userId: user.id } })).items).toEqual([]);
  });

  it('CHK-02: charges the current price, not the one saved in the cart', async () => {
    const user = await makeUser();
    const lamp = await makeProduct({ price: '40.00' });
    await makeCart({ userId: user.id }, [lineFor(lamp, 1)]);
    await prisma.product.update({ where: { id: lamp.id }, data: { price: '55.00' } });

    await as(signedIn(user), createOrder);

    const item = await prisma.orderItem.findFirstOrThrow({ where: { productId: lamp.id } });
    expect(item.price.toString()).toBe('55');
  });

  it('CHK-03: one sold-out line rolls back the whole order, including stock already taken', async () => {
    const user = await makeUser();
    const a = await makeProduct({ stock: 5 });
    const b = await makeProduct({ stock: 5 });
    const soldOut = await makeProduct({ stock: 0 });
    await makeCart({ userId: user.id }, [lineFor(a, 1), lineFor(b, 2), lineFor(soldOut, 1)]);

    const res = await as(signedIn(user), createOrder);

    expect(res).toEqual({ success: false, message: `Not enough stock for ${soldOut.name}` });
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderEvent.count()).toBe(0);
    expect(await stockOf(a.id)).toBe(5); // decremented inside the transaction, then rolled back
    expect(await stockOf(b.id)).toBe(5);
    expect((await prisma.cart.findFirstOrThrow({ where: { userId: user.id } })).items).toHaveLength(3);
  });

  it('CHK-04: two customers racing for the last unit - exactly one gets it', async () => {
    const lastOne = await makeProduct({ stock: 1 });
    const alice = await makeUser();
    const bob = await makeUser();
    await makeCart({ userId: alice.id }, [lineFor(lastOne, 1)]);
    await makeCart({ userId: bob.id }, [lineFor(lastOne, 1)]);

    race.arm(2); // both read their carts before either checks out
    const results = await Promise.all([
      as(signedIn(alice), createOrder),
      as(signedIn(bob), createOrder),
    ]);

    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.find((r) => !r.success)?.message).toBe(`Not enough stock for ${lastOne.name}`);
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(lastOne.id)).toBe(0);
  });

  it('CHK-07: a double-click on "Place order" creates one order', async () => {
    const user = await makeUser();
    const lamp = await makeProduct({ stock: 10 });
    await makeCart({ userId: user.id }, [lineFor(lamp, 1)]);

    race.arm(2); // both clicks read the full cart before either empties it
    const results = await Promise.all([
      as(signedIn(user), createOrder),
      as(signedIn(user), createOrder),
    ]);

    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(lamp.id)).toBe(9);
  });
});

describe('addItemToCart', () => {
  it('CRT-10: two concurrent adds both land - neither overwrites the other', async () => {
    const lamp = await makeProduct({ stock: 10 });
    const visitor = guest('guest-cart-1');
    await makeCart({ sessionCartId: 'guest-cart-1' }, []);

    // Both requests pass the existence check, then both read version 0
    race.arm(2, 2);
    const results = await Promise.all([
      as(visitor, () => addItemToCart(lineFor(lamp))),
      as(visitor, () => addItemToCart(lineFor(lamp))),
    ]);

    expect(results.every((r) => r.success)).toBe(true);
    const cart = await prisma.cart.findFirstOrThrow({ where: { sessionCartId: 'guest-cart-1' } });
    expect(cart.items).toEqual([expect.objectContaining({ productId: lamp.id, qty: 2 })]);
    expect(cart.version).toBe(2);
  });
});
