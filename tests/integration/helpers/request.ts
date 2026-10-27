import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Who is calling and with which cookies. Kept per async call chain, so two
 * concurrent requests in one test each see their own session and cookies -
 * which is what the race tests need.
 */
export interface Visitor {
  session: { user: { id: string; role: string; name?: string; email?: string } } | null;
  cookies: Record<string, string>;
}

const storage = new AsyncLocalStorage<Visitor>();

/** Run `fn` as this visitor. Everything it awaits sees the same request. */
export function as<T>(visitor: Visitor, fn: () => Promise<T>): Promise<T> {
  return storage.run(visitor, fn);
}

export const guest = (cartId = 'guest-cart', wishlistId = 'guest-wishlist'): Visitor => ({
  session: null,
  cookies: { sessionCartId: cartId, sessionWishlistId: wishlistId },
});

export const signedIn = (
  user: { id: string; role?: string; name?: string; email?: string },
  cookies: Record<string, string> = { sessionCartId: `cart-of-${user.id}` }
): Visitor => ({
  session: { user: { role: 'user', ...user } },
  cookies,
});

/** Replaces `auth()` from `@/auth`. */
export async function auth() {
  return storage.getStore()?.session ?? null;
}

/** Replaces `next/headers`. */
export const nextHeaders = {
  async cookies() {
    const jar = storage.getStore()?.cookies ?? {};
    return {
      get: (name: string) => (name in jar ? { name, value: jar[name] } : undefined),
      set: (name: string, value: string) => {
        jar[name] = value;
      },
      delete: (name: string) => {
        delete jar[name];
      },
    };
  },
  async headers() {
    return new Headers({ 'x-forwarded-for': '127.0.0.1' });
  },
};
