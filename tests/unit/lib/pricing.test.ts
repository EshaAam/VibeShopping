/**
 * calcPrice decides what every cart and order costs. These pin the boundaries
 * (free shipping, rounding) and check the chat fast path quotes the same rules,
 * so the assistant can't promise a price checkout won't honour.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/prisma', () => ({ prisma: {} }));

import { calcPrice } from '@/lib/utils';
import { tryFastPath } from '@/lib/ai/fastPath';

const one = (price: string | number, qty = 1) => calcPrice([{ price, qty }]);

describe('calcPrice', () => {
  it('PRC-01: $100.00 exactly still pays shipping (free is over $100)', () => {
    expect(one('100.00')).toEqual({
      itemsPrice: '100.00',
      shippingPrice: '10.00',
      taxPrice: '15.00',
      totalPrice: '125.00',
    });
  });

  it('PRC-02: $100.01 ships free', () => {
    expect(one('100.01').shippingPrice).toBe('0.00');
  });

  it('PRC-03: tax is 15%, rounded to the cent', () => {
    expect(one('33.33').taxPrice).toBe('5.00'); // 4.9995 rounds up
    expect(one('10.01').taxPrice).toBe('1.50'); // 1.5015 rounds down
  });

  it('PRC-04: no floating point noise in the totals', () => {
    expect(one(0.1, 3).itemsPrice).toBe('0.30');
  });

  it('PRC-05: an empty cart still carries the flat shipping fee', () => {
    // Pinned on purpose: an empty order is blocked before checkout, but if that
    // guard ever goes, this is the total it would be charged.
    expect(calcPrice([])).toEqual({
      itemsPrice: '0.00',
      shippingPrice: '10.00',
      taxPrice: '0.00',
      totalPrice: '10.00',
    });
  });

  it('PRC-06: a Decimal-as-string price gives the same result as a number', () => {
    expect(calcPrice([{ price: '19.99', qty: 2 }])).toEqual(
      calcPrice([{ price: 19.99, qty: 2 }])
    );
  });
});

describe('fast path quotes the real pricing rules', () => {
  const guest = { isSignedIn: false, name: null, cart: null, orders: null };

  it('PRC-07: shipping answer matches calcPrice', async () => {
    const reply = await tryFastPath('how much is shipping?', guest);
    expect(reply?.answer).toMatch(/free on orders over \$100/);
    expect(reply?.answer).toMatch(/flat \$10/);
    expect(one('100.01').shippingPrice).toBe('0.00');
    expect(one('99.99').shippingPrice).toBe('10.00');
  });

  it('PRC-07: tax answer matches calcPrice', async () => {
    const reply = await tryFastPath('is there tax?', guest);
    expect(reply?.answer).toMatch(/15%/);
    expect(one('100.00').taxPrice).toBe('15.00');
  });
});
