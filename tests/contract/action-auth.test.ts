/**
 * Every export of a 'use server' file is a public POST endpoint. This suite
 * imports every action module, calls every export, and checks that it turns
 * away callers without the right session - so a new action that forgets its
 * auth check fails CI instead of shipping.
 *
 * New actions are treated as admin-only by default. To make one callable by
 * guests or by any signed-in user, add it to PUBLIC or SIGNED_IN below - an
 * explicit, reviewable decision.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Any database or Stripe access means the action did work before checking
// who was calling. Fail loudly instead of letting it pass by accident.
function forbidden(name: string) {
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then' || typeof prop === 'symbol') return undefined;
        throw new Error(`${name}.${String(prop)} reached before auth check`);
      },
    }
  );
}

const authMock = vi.hoisted(() => vi.fn());

// The auth guard re-reads the caller's role from the database - the one query
// allowed before the check. Every other table access still fails the test.
const userLookup = vi.hoisted(() =>
  vi.fn(async ({ where }: { where: { id: string } }) =>
    where.id === 'user-1' ? { role: 'user' } : null
  )
);

vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({
  auth: authMock,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/db/prisma', () => ({
  prisma: new Proxy(
    {},
    {
      get(_, table) {
        if (table === 'user') return { findUnique: userLookup };
        return forbidden(`prisma.${String(table)}`);
      },
    }
  ),
}));
vi.mock('@/lib/stripe', () => ({ stripe: forbidden('stripe') }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import * as cartActions from '@/lib/actions/cart.actions';
import * as chatActions from '@/lib/actions/chat.actions';
import * as orderActions from '@/lib/actions/order.actions';
import * as paymentActions from '@/lib/actions/payment.actions';
import * as productActions from '@/lib/actions/product.actions';
import * as reviewActions from '@/lib/actions/review.actions';
import * as userActions from '@/lib/actions/user.actions';
import * as wishlistActions from '@/lib/actions/wishlist.actions';
import * as orderData from '@/lib/data/order';
import * as userData from '@/lib/data/user';

/** Guests may call these (guest cart, browsing, chat, auth itself). */
const PUBLIC = new Set([
  'addItemToCart',
  'removeItemFromCart',
  'sendChatMessage',
  'getSearchSuggestions',
  'checkIfUserPurchasedProduct',
  'getReviews',
  'signInWithCredentials',
  'signUpUser',
  'signOutUser',
  'addItemToWishlist',
  'removeItemFromWishlist',
]);

/** Any signed-in user may call these; they scope themselves to that user. */
const SIGNED_IN = new Set([
  'createOrder',
  'placeOrder',
  'saveShippingAddress',
  'savePaymentMethod',
  'cancelOrder',
  'createStripePaymentIntent',
  'confirmStripePayment',
  'createUpdateReview',
  'getReviewByProductId',
  'updateUserAddress',
  'updateUserPaymentMethod',
  'updateProfile',
]);

const actionModules = {
  cartActions,
  chatActions,
  orderActions,
  paymentActions,
  productActions,
  reviewActions,
  userActions,
  wishlistActions,
};

type AnyFn = (...args: unknown[]) => Promise<unknown>;

const actions = Object.entries(actionModules).flatMap(([mod, exports]) =>
  Object.entries(exports).map(([name, fn]) => ({
    id: `${mod}.${name}`,
    name,
    fn: fn as AnyFn,
  }))
);

/** Call an action and return its error text, whether it throws or returns one. */
async function rejection(fn: AnyFn): Promise<string> {
  try {
    const result = (await fn({}, {}, {})) as { success?: boolean; message?: string };
    if (result && result.success === false) return String(result.message);
    return `resolved without an error: ${JSON.stringify(result)}`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const AUTH_ERROR = /not authenticated|unauthorized/i;
const ADMIN_ERROR = /admin access required/i;

const asUser = { user: { id: 'user-1', role: 'user', name: 'Test', email: 't@t.io' } };

beforeEach(() => authMock.mockReset());

describe('server action auth', () => {
  it('only exports functions from action modules', () => {
    for (const { id, fn } of actions) {
      expect(typeof fn, id).toBe('function');
    }
  });

  it('has no stale names in the allowlists', () => {
    const names = new Set(actions.map((a) => a.name));
    for (const name of [...PUBLIC, ...SIGNED_IN]) {
      expect(names.has(name), `${name} is allowlisted but not exported`).toBe(true);
    }
  });

  const protectedActions = actions.filter((a) => !PUBLIC.has(a.name));
  it.each(protectedActions.map((a) => [a.id, a.fn] as const))(
    '%s rejects anonymous callers',
    async (_, fn) => {
      authMock.mockResolvedValue(null);
      expect(await rejection(fn)).toMatch(AUTH_ERROR);
    }
  );

  const adminActions = protectedActions.filter((a) => !SIGNED_IN.has(a.name));
  it.each(adminActions.map((a) => [a.id, a.fn] as const))(
    '%s rejects signed-in non-admins',
    async (_, fn) => {
      authMock.mockResolvedValue(asUser);
      expect(await rejection(fn)).toMatch(ADMIN_ERROR);
    }
  );
});

describe('data layer auth', () => {
  const adminReads: [string, AnyFn][] = [
    ['getAllOrders', orderData.getAllOrders as AnyFn],
    ['getOrderSummary', orderData.getOrderSummary as AnyFn],
    ['getSalesChartData', orderData.getSalesChartData as AnyFn],
    ['getAllUsers', userData.getAllUsers as AnyFn],
  ];

  it.each(adminReads)('%s rejects signed-in non-admins', async (_, fn) => {
    authMock.mockResolvedValue(asUser);
    expect(await rejection(fn)).toMatch(ADMIN_ERROR);
  });

  it('getUserById refuses to load another user', async () => {
    authMock.mockResolvedValue(asUser);
    await expect(userData.getUserById('someone-else')).rejects.toThrow(AUTH_ERROR);
  });

  it('getOrderById requires a session', async () => {
    authMock.mockResolvedValue(null);
    await expect(orderData.getOrderById('order-1')).rejects.toThrow(AUTH_ERROR);
  });
});
