/**
 * Two quick "add to cart" clicks both read the same cart. Without versioning
 * the second write overwrites the first and an item is lost. These tests pin
 * down the fix: a save is conditional on the version read, and a conflicting
 * save re-reads and re-applies its change on top.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMyCart, updateMany, findFirst } = vi.hoisted(() => ({
  getMyCart: vi.fn(),
  updateMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'session-1' }) }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/data/cart', () => ({ getMyCart }));
vi.mock('@/db/prisma', () => ({
  prisma: {
    product: { findFirst },
    cart: { updateMany, create: vi.fn() },
  },
}));

import { addItemToCart } from '@/lib/actions/cart.actions';

const product = {
  id: 'p1',
  name: 'Lamp',
  slug: 'lamp',
  images: ['lamp.jpg'],
  price: '10.00',
  stock: 10,
  archivedAt: null,
};

const line = (qty: number) => ({
  productId: 'p1',
  name: 'Lamp',
  slug: 'lamp',
  image: 'lamp.jpg',
  price: '10.00',
  qty,
});

const cart = (version: number, qty: number) => ({
  id: 'cart-1',
  version,
  items: [line(qty)],
});

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue(product);
});

describe('cart optimistic concurrency', () => {
  it('re-applies the change when another request saved first', async () => {
    getMyCart
      .mockResolvedValueOnce(cart(0, 1)) // existence check
      .mockResolvedValueOnce(cart(0, 1)) // first attempt reads v0
      .mockResolvedValueOnce(cart(1, 2)); // after the conflict: the other click landed
    updateMany
      .mockResolvedValueOnce({ count: 0 }) // v0 is stale - someone else saved
      .mockResolvedValueOnce({ count: 1 });

    const res = await addItemToCart(line(1));

    expect(res.success).toBe(true);
    expect(updateMany).toHaveBeenCalledTimes(2);

    const retry = updateMany.mock.calls[1][0];
    expect(retry.where).toEqual({ id: 'cart-1', version: 1 });
    // Built on the other request's qty 2, not the stale qty 1 - nothing lost
    expect(retry.data.items[0].qty).toBe(3);
    expect(retry.data.version).toEqual({ increment: 1 });
  });

  it('gives up with a clear message after repeated conflicts', async () => {
    getMyCart.mockResolvedValue(cart(0, 1));
    updateMany.mockResolvedValue({ count: 0 });

    const res = await addItemToCart(line(1));

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/changed elsewhere/);
    expect(updateMany).toHaveBeenCalledTimes(3);
  });
});
