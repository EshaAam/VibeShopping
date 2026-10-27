/**
 * Which chat messages load the customer's cart and orders, and whose data that
 * is. Calling a personal question generic can't leak anything (the generic path
 * loads no one's data); it only gives a less personal answer. Calling a
 * generic question personal costs a lookup and skips the cache.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  cartFindFirst: vi.fn(),
  orderFindMany: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: h.auth }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'session-cart-1' }) }),
}));
vi.mock('@/db/prisma', () => ({
  prisma: { cart: { findFirst: h.cartFindFirst }, order: { findMany: h.orderFindMany } },
}));

import { getUserContext, isPersonalQuestion } from '@/lib/ai/userContext';

beforeEach(() => {
  vi.clearAllMocks();
  h.cartFindFirst.mockResolvedValue(null);
  h.orderFindMany.mockResolvedValue([]);
});

describe('isPersonalQuestion', () => {
  it.each([
    'where is my order?',
    "what's in my cart",
    'track package 4421',
    'when does the delivery arrive',
    'can I get a refund',
    'what did I purchase last month',
    'show me my wishlist',
    'has the parcel shipped',
  ])('"%s" is personal', (message) => {
    expect(isPersonalQuestion(message)).toBe(true);
  });

  // Regression: "me" and "I" alone used to make these personal, so the most
  // common phrasings were never cached and loaded the customer's data for nothing.
  it.each([
    'show me gaming laptops',
    'tell me about lamps',
    'I need running shoes under 100 dollars',
    'do you have red sneakers',
    'which laptop is best for students',
  ])('"%s" is generic', (message) => {
    expect(isPersonalQuestion(message)).toBe(false);
  });
});

describe('getUserContext', () => {
  it("AI-23: only ever reads the signed-in customer's own orders", async () => {
    h.auth.mockResolvedValue({ user: { id: 'user-1', name: 'Alice' } });

    await getUserContext();

    expect(h.orderFindMany.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
    expect(h.cartFindFirst.mock.calls[0][0].where).toMatchObject({ userId: 'user-1' });
  });

  it('a guest gets their own guest cart and no orders at all', async () => {
    h.auth.mockResolvedValue(null);

    const context = await getUserContext();

    expect(context.isSignedIn).toBe(false);
    expect(h.orderFindMany).not.toHaveBeenCalled();
    expect(h.cartFindFirst.mock.calls[0][0].where).toMatchObject({
      sessionCartId: 'session-cart-1',
      userId: null,
    });
  });

  it('a failing lookup degrades to an empty context instead of breaking the chat', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.auth.mockResolvedValue({ user: { id: 'user-1' } });
    h.orderFindMany.mockRejectedValue(new Error('db down'));

    expect(await getUserContext()).toEqual({
      isSignedIn: false,
      name: null,
      cart: null,
      orders: null,
    });
  });
});
