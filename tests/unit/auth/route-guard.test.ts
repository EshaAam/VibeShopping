/**
 * The middleware's `authorized` callback: which pages need a session, which
 * need an admin, and the guest cart/wishlist cookies it mints. Those cookies
 * are the only thing guarding a guest's cart, so their flags matter.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/prisma', () => ({ prisma: {} }));
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));

import { NextRequest } from 'next/server';
import { config } from '@/auth';

type Authorized = (args: { request: NextRequest; auth: unknown }) => unknown;
const authorized = config.callbacks.authorized as Authorized;

const BOTH_COOKIES = 'sessionCartId=c1; sessionWishlistId=w1';

function visit(path: string, { session = null as unknown, cookie = BOTH_COOKIES } = {}) {
  const request = new NextRequest(`http://shop.test${path}`, {
    headers: cookie ? { cookie } : {},
  });
  return authorized({ request, auth: session });
}

const customer = { user: { id: 'user-1', role: 'user' } };
const admin = { user: { id: 'admin-1', role: 'admin' } };

const setCookie = (res: unknown, name: string) =>
  (res as Response).headers.getSetCookie().find((c) => c.startsWith(`${name}=`));

afterEach(() => vi.unstubAllEnvs());

describe('protected pages', () => {
  const PROTECTED = [
    '/shipping-address',
    '/payment-method',
    '/place-order',
    '/user/profile',
    '/user/orders',
    '/order/0b0f3d9e-0000-4000-8000-000000000000',
    '/admin',
    '/admin/products',
  ];
  const PUBLIC = ['/', '/product/laptop', '/cart', '/search', '/wishlist', '/sign-in', '/share/cart/abc'];

  it.each(PROTECTED)('AUT-05: %s sends a signed-out visitor to sign in', (path) => {
    expect(visit(path)).toBe(false);
  });

  it.each(PUBLIC)('%s is open to guests', (path) => {
    expect(visit(path)).toBe(true);
  });

  it('a signed-in customer reaches their own pages', () => {
    expect(visit('/user/orders', { session: customer })).toBe(true);
    expect(visit('/place-order', { session: customer })).toBe(true);
  });
});

describe('admin area', () => {
  it.each(['/admin', '/admin/orders', '/admin/users/u1'])(
    'AUT-06: %s redirects a signed-in non-admin home',
    (path) => {
      const res = visit(path, { session: customer }) as Response;
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://shop.test/');
    }
  );

  it('lets an admin in', () => {
    expect(visit('/admin/orders', { session: admin })).toBe(true);
  });
});

describe('guest session cookies', () => {
  it('AUT-07: a first visit gets both ids as httpOnly, sameSite=lax, site-wide cookies', () => {
    const res = visit('/', { cookie: '' });

    for (const name of ['sessionCartId', 'sessionWishlistId']) {
      const cookie = setCookie(res, name);
      expect(cookie, name).toMatch(new RegExp(`^${name}=[0-9a-f-]{36};`));
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=lax/i);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).not.toMatch(/Secure/i); // plain http in development
    }
  });

  it('AUT-07: cookies are Secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(setCookie(visit('/', { cookie: '' }), 'sessionCartId')).toMatch(/Secure/i);
  });

  it('only mints the cookie that is missing, and never reuses an id', () => {
    const res = visit('/', { cookie: 'sessionCartId=c1' });
    expect(setCookie(res, 'sessionCartId')).toBeUndefined();
    expect(setCookie(res, 'sessionWishlistId')).toBeDefined();

    const first = setCookie(visit('/', { cookie: '' }), 'sessionCartId');
    const second = setCookie(visit('/', { cookie: '' }), 'sessionCartId');
    expect(first).not.toBe(second);
  });

  it('a protected page refuses a guest before minting anything', () => {
    expect(visit('/place-order', { cookie: '' })).toBe(false);
  });
});
