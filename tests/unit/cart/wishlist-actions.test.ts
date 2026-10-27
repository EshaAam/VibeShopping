/**
 * The wishlist follows the cart's rules: product details come from the
 * database, and saves are conditional on the version read so two quick clicks
 * can't overwrite each other.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMyWishlist, productFindFirst, wishlistCreate, wishlistUpdateMany } = vi.hoisted(
  () => ({
    getMyWishlist: vi.fn(),
    productFindFirst: vi.fn(),
    wishlistCreate: vi.fn(),
    wishlistUpdateMany: vi.fn(),
  })
);

vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'wishlist-session-1' }) }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/data/wishlist', () => ({ getMyWishlist }));
vi.mock('@/db/prisma', () => ({
  prisma: {
    product: { findFirst: productFindFirst },
    wishlist: { create: wishlistCreate, updateMany: wishlistUpdateMany },
  },
}));

import { addItemToWishlist, removeItemFromWishlist } from '@/lib/actions/wishlist.actions';

const product = (id: string, price: string) => ({
  id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  images: [`${id}.jpg`],
  price,
  archivedAt: null,
});

const entry = (id: string, price: string) => ({
  productId: id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  price,
  image: `${id}.jpg`,
});

const tampered = { ...entry('p1', '0.01'), image: 'cheap.jpg' };

const wishlist = (version: number, items: ReturnType<typeof entry>[]) => ({
  id: 'wishlist-1',
  version,
  items,
});

beforeEach(() => {
  vi.clearAllMocks();
  productFindFirst.mockResolvedValue(product('p1', '250.00'));
  wishlistUpdateMany.mockResolvedValue({ count: 1 });
});

describe('wishlist', () => {
  it('CRT-11: a new wishlist stores the database price and image', async () => {
    getMyWishlist.mockResolvedValue(undefined);

    const res = await addItemToWishlist(tampered);

    expect(res.success).toBe(true);
    expect(wishlistCreate.mock.calls[0][0].data).toEqual({
      userId: null,
      sessionWishlistId: 'wishlist-session-1',
      items: [entry('p1', '250.00')],
    });
  });

  it('refuses an archived product', async () => {
    productFindFirst.mockResolvedValue({ ...product('p1', '250.00'), archivedAt: new Date() });

    expect(await addItemToWishlist(tampered)).toEqual({
      success: false,
      message: 'This product is no longer available',
    });
    expect(wishlistCreate).not.toHaveBeenCalled();
  });

  it('reports a product that is already there instead of duplicating it', async () => {
    getMyWishlist.mockResolvedValue(wishlist(0, [entry('p1', '250.00')]));

    expect(await addItemToWishlist(tampered)).toEqual({
      success: false,
      message: 'Item already in wishlist',
    });
    expect(wishlistUpdateMany.mock.calls[0][0].data.items).toEqual([entry('p1', '250.00')]);
  });

  it('CRT-11: re-applies the change when another request saved first', async () => {
    getMyWishlist
      .mockResolvedValueOnce(wishlist(0, [])) // existence check
      .mockResolvedValueOnce(wishlist(0, [])) // first attempt reads v0
      .mockResolvedValueOnce(wishlist(1, [entry('p2', '9.00')])); // the other click landed
    wishlistUpdateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    const res = await addItemToWishlist(tampered);

    expect(res.success).toBe(true);
    const retry = wishlistUpdateMany.mock.calls[1][0];
    expect(retry.where).toEqual({ id: 'wishlist-1', version: 1 });
    expect(retry.data.items).toEqual([entry('p2', '9.00'), entry('p1', '250.00')]);
  });

  it('CRT-11: gives up with a clear message after repeated conflicts', async () => {
    getMyWishlist.mockResolvedValue(wishlist(0, []));
    wishlistUpdateMany.mockResolvedValue({ count: 0 });

    const res = await addItemToWishlist(tampered);

    expect(res).toEqual({
      success: false,
      message: 'Your wishlist was changed elsewhere, please try again',
    });
    expect(wishlistUpdateMany).toHaveBeenCalledTimes(3);
  });

  it('removes a product, and refuses one that is not there', async () => {
    getMyWishlist.mockResolvedValue(wishlist(0, [entry('p1', '250.00')]));
    expect((await removeItemFromWishlist('p1')).success).toBe(true);
    expect(wishlistUpdateMany.mock.calls[0][0].data.items).toEqual([]);

    getMyWishlist.mockResolvedValue(wishlist(0, []));
    expect(await removeItemFromWishlist('p1')).toEqual({
      success: false,
      message: 'Item not found',
    });
  });
});
