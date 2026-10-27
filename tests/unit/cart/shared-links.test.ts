/**
 * /share/cart/<id> and /share/wishlist/<id> are public: anyone with the link
 * can open them. They may show what's in the list and whose it is, but never
 * the guest session id (it is the key to a guest's cart) or account ids.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cartFindFirst, wishlistFindFirst } = vi.hoisted(() => ({
  cartFindFirst: vi.fn(),
  wishlistFindFirst: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: vi.fn() }) }));
vi.mock('@/db/prisma', () => ({
  prisma: {
    cart: { findFirst: cartFindFirst },
    wishlist: { findFirst: wishlistFindFirst },
  },
}));

import { getSharedCart } from '@/lib/data/cart';
import { getSharedWishlist } from '@/lib/data/wishlist';

/**
 * Behaves like Prisma for `select` and `include`, so the test checks what the
 * query would really return rather than which option the code passed.
 */
function fakeFindFirst(row: Record<string, unknown>, user: Record<string, unknown>) {
  return async ({ select, include }: { select?: Record<string, unknown>; include?: unknown }) => {
    if (!select) return { ...row, ...(include ? { user } : {}) };
    return Object.fromEntries(
      Object.keys(select).map((key) => [key, key === 'user' ? { name: user.name } : row[key]])
    );
  };
}

const item = { productId: 'p1', name: 'Lamp', slug: 'lamp', image: 'lamp.jpg', price: '40.00', qty: 2 };
const owner = { name: 'Alice', email: 'alice@shop.io', password: 'hash' };

const cartRow = {
  id: 'cart-1',
  userId: 'user-1',
  sessionCartId: 'secret-session-id',
  items: [item],
  itemsPrice: '80.00',
  shippingPrice: '10.00',
  taxPrice: '12.00',
  totalPrice: '102.00',
  version: 4,
  createdAt: new Date('2026-10-01T00:00:00Z'),
};

const wishlistRow = {
  id: 'wishlist-1',
  userId: 'user-1',
  sessionWishlistId: 'secret-wishlist-session',
  items: [{ productId: 'p1', name: 'Lamp', slug: 'lamp', image: 'lamp.jpg', price: '40.00' }],
  version: 2,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-02T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  cartFindFirst.mockImplementation(fakeFindFirst(cartRow, owner));
  wishlistFindFirst.mockImplementation(fakeFindFirst(wishlistRow, owner));
});

describe('shared cart', () => {
  it('SHR-02: shows the items, totals and owner name - and nothing that identifies a session', async () => {
    const shared = await getSharedCart('cart-1');

    expect(shared).toMatchObject({
      items: [item],
      itemsPrice: '80.00',
      totalPrice: '102.00',
      userName: 'Alice',
    });
    expect(shared).not.toHaveProperty('sessionCartId');
    expect(shared).not.toHaveProperty('userId');
    expect(JSON.stringify(shared)).not.toMatch(/secret-session-id|alice@shop\.io/);
  });

  it('SHR-01: an unknown or malformed id is a 404, not a crash', async () => {
    cartFindFirst.mockResolvedValueOnce(null);
    expect(await getSharedCart('missing')).toBeUndefined();

    cartFindFirst.mockRejectedValueOnce(new Error('invalid input syntax for type uuid'));
    expect(await getSharedCart('not-a-uuid')).toBeUndefined();
  });

  it("a guest's cart is shown as someone's", async () => {
    cartFindFirst.mockImplementation(fakeFindFirst({ ...cartRow, userId: null }, { name: null }));
    expect((await getSharedCart('cart-1'))?.userName).toBe('Someone');
  });
});

describe('shared wishlist', () => {
  it('shows the items and owner name, but no session or account id', async () => {
    const shared = await getSharedWishlist('wishlist-1');

    expect(shared).toMatchObject({ items: wishlistRow.items, userName: 'Alice' });
    expect(shared).not.toHaveProperty('sessionWishlistId');
    expect(shared).not.toHaveProperty('userId');
  });
});
