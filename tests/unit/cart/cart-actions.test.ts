/**
 * Adding to and removing from the cart. The client only gets to say which
 * product: name, image and above all price come from the database, so a
 * tampered request can't change what the customer is charged.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, cookieGet, getMyCart, productFindFirst, cartCreate, cartUpdateMany } = vi.hoisted(
  () => ({
    auth: vi.fn(async () => null as unknown),
    cookieGet: vi.fn((name: string) =>
      name === 'sessionCartId' ? { value: 'session-1' } : undefined
    ),
    getMyCart: vi.fn(),
    productFindFirst: vi.fn(),
    cartCreate: vi.fn(),
    cartUpdateMany: vi.fn(),
  })
);

vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/data/cart', () => ({ getMyCart }));
vi.mock('@/db/prisma', () => ({
  prisma: {
    product: { findFirst: productFindFirst },
    cart: { create: cartCreate, updateMany: cartUpdateMany },
  },
}));

import { addItemToCart, removeItemFromCart } from '@/lib/actions/cart.actions';

const laptop = {
  id: 'p1',
  name: 'Laptop',
  slug: 'laptop',
  images: ['laptop.jpg', 'laptop-2.jpg'],
  price: '1400.00',
  stock: 3,
  archivedAt: null,
};

/** What a tampered client sends: right product, made-up price and image. */
const tampered = {
  productId: 'p1',
  name: 'Laptop',
  slug: 'laptop',
  image: 'cheap.jpg',
  price: '0.01',
  qty: 1,
};

const line = (qty: number) => ({
  productId: 'p1',
  name: 'Laptop',
  slug: 'laptop',
  image: 'laptop.jpg',
  price: '1400.00',
  qty,
});

const cart = (items: ReturnType<typeof line>[]) => ({ id: 'cart-1', version: 0, items });

/** The data of the n-th cart save. */
const saved = (n = 0) => cartUpdateMany.mock.calls[n][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  productFindFirst.mockResolvedValue(laptop);
  cartUpdateMany.mockResolvedValue({ count: 1 });
});

describe('addItemToCart', () => {
  it('CRT-01: a new cart stores the database price, not the one the client sent', async () => {
    getMyCart.mockResolvedValue(undefined);

    const res = await addItemToCart(tampered);

    expect(res.success).toBe(true);
    const data = cartCreate.mock.calls[0][0].data;
    expect(data.items).toEqual([line(1)]);
    expect(data).toMatchObject({
      itemsPrice: '1400.00',
      shippingPrice: '0.00',
      taxPrice: '210.00',
      totalPrice: '1610.00',
    });
  });

  it('CRT-01: an existing cart also stores the database price', async () => {
    getMyCart.mockResolvedValue(cart([]));

    await addItemToCart(tampered);

    expect(saved().items).toEqual([line(1)]);
    expect(saved().itemsPrice).toBe('1400.00');
  });

  it('CRT-04: a guest cart is tied to the session cookie, a signed-in one to the user', async () => {
    getMyCart.mockResolvedValue(undefined);
    await addItemToCart(tampered);
    expect(cartCreate.mock.calls[0][0].data).toMatchObject({
      sessionCartId: 'session-1',
      userId: undefined,
    });

    auth.mockResolvedValueOnce({ user: { id: 'user-1' } });
    await addItemToCart(tampered);
    expect(cartCreate.mock.calls[1][0].data.userId).toBe('user-1');
  });

  it('adding a product that is already in the cart bumps its quantity', async () => {
    getMyCart.mockResolvedValue(cart([line(1)]));

    const res = await addItemToCart(tampered);

    expect(res.message).toBe('Laptop updated in cart successfully');
    expect(saved().items).toEqual([line(2)]);
    expect(saved().itemsPrice).toBe('2800.00');
  });

  it('CRT-02: refuses an archived product', async () => {
    productFindFirst.mockResolvedValue({ ...laptop, archivedAt: new Date() });

    const res = await addItemToCart(tampered);

    expect(res).toEqual({ success: false, message: 'This product is no longer available' });
    expect(cartCreate).not.toHaveBeenCalled();
    expect(cartUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses a product that does not exist', async () => {
    productFindFirst.mockResolvedValue(null);
    expect(await addItemToCart(tampered)).toEqual({
      success: false,
      message: 'Product not found',
    });
  });

  it('CRT-03: refuses to go past the stock already in the cart', async () => {
    getMyCart.mockResolvedValue(cart([line(3)])); // stock is 3

    const res = await addItemToCart(tampered);

    expect(res).toEqual({ success: false, message: 'Not enough stock' });
    expect(cartUpdateMany).not.toHaveBeenCalled();
  });

  it('CRT-03: refuses a sold-out product on a brand new cart', async () => {
    getMyCart.mockResolvedValue(undefined);
    productFindFirst.mockResolvedValue({ ...laptop, stock: 0 });

    expect(await addItemToCart(tampered)).toEqual({
      success: false,
      message: 'Not enough stock',
    });
    expect(cartCreate).not.toHaveBeenCalled();
  });

  it('CRT-07: refuses without a cart session cookie, before reading anything', async () => {
    cookieGet.mockReturnValueOnce(undefined);

    expect(await addItemToCart(tampered)).toEqual({
      success: false,
      message: 'Cart Session not found',
    });
    expect(productFindFirst).not.toHaveBeenCalled();
  });
});

describe('removeItemFromCart', () => {
  it('CRT-05: the last unit removes the line', async () => {
    getMyCart.mockResolvedValue(cart([line(1)]));

    const res = await removeItemFromCart('p1');

    expect(res.message).toBe('Laptop removed from cart successfully');
    expect(saved().items).toEqual([]);
    expect(saved().itemsPrice).toBe('0.00');
  });

  it('CRT-05: otherwise the quantity drops by one and totals follow', async () => {
    getMyCart.mockResolvedValue(cart([line(2)]));

    const res = await removeItemFromCart('p1');

    expect(res.message).toBe('Laptop updated in cart successfully');
    expect(saved().items).toEqual([line(1)]);
    expect(saved().itemsPrice).toBe('1400.00');
  });

  it('CRT-06: removing something that is not in the cart writes nothing', async () => {
    getMyCart.mockResolvedValue(cart([]));

    expect(await removeItemFromCart('p1')).toEqual({
      success: false,
      message: 'Item not found',
    });
    expect(cartUpdateMany).not.toHaveBeenCalled();
  });

  it('CRT-07: refuses without a cart session cookie', async () => {
    cookieGet.mockReturnValueOnce(undefined);

    expect(await removeItemFromCart('p1')).toEqual({
      success: false,
      message: 'Cart Session not found',
    });
    expect(productFindFirst).not.toHaveBeenCalled();
  });
});
