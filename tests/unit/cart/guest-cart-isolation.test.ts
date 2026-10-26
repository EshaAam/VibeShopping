/**
 * A signed-out browser used to hand the next visitor the previous user's cart:
 * guest carts were found by the cookie alone, and the cookie outlived sign-out.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, cookieStore, cartFindFirst } = vi.hoisted(() => ({
  auth: vi.fn(),
  cookieStore: {
    get: vi.fn((name: string) => ({ value: `${name}-from-cookie` })),
    delete: vi.fn(),
  },
  cartFindFirst: vi.fn(async () => null),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/db/prisma', () => ({ prisma: { cart: { findFirst: cartFindFirst } } }));

import { getMyCart } from '@/lib/data/cart';
import { signOutUser } from '@/lib/actions/user.actions';

beforeEach(() => vi.clearAllMocks());

describe('shared browser after sign-out', () => {
  it('only gives a guest a cart that no account has claimed', async () => {
    auth.mockResolvedValue(null);

    await getMyCart();

    expect(cartFindFirst).toHaveBeenCalledWith({
      where: { sessionCartId: 'sessionCartId-from-cookie', userId: null },
    });
  });

  it('still finds a signed-in user cart by account', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });

    await getMyCart();

    expect(cartFindFirst).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('clears the guest cart and wishlist ids on sign-out', async () => {
    await signOutUser();

    expect(cookieStore.delete).toHaveBeenCalledWith('sessionCartId');
    expect(cookieStore.delete).toHaveBeenCalledWith('sessionWishlistId');
  });
});
