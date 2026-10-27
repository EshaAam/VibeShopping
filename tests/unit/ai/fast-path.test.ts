/**
 * Questions answered from code instead of Gemini. They cost no quota, so the
 * rules must catch the common questions - and leave anything specific about
 * products to the model.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/retrieval', () => ({
  getCatalogSummary: vi.fn(async () => ({})),
  formatCatalog: vi.fn(() => '- Laptops (3 in stock)'),
}));

import { tryFastPath } from '@/lib/ai/fastPath';
import type { UserContext } from '@/lib/ai/userContext';

const guest: UserContext = { isSignedIn: false, name: null, cart: null, orders: null };
const alice: UserContext = { isSignedIn: true, name: 'Alice', cart: null, orders: null };

describe('tryFastPath', () => {
  it.each([
    ['hi', 'greeting'],
    ['Hello!', 'greeting'],
    ['thanks', 'thanks'],
    ['how much is shipping?', 'shipping'],
    ['is there tax?', 'tax'],
    ['what payment methods do you accept', 'payment-methods'],
    ['how do i place an order', 'checkout-steps'],
    ['what do you sell?', 'catalog'],
  ])('AI-03: "%s" is answered by the %s rule', async (message, rule) => {
    expect((await tryFastPath(message, guest))?.rule).toBe(rule);
  });

  it.each(['do you have red sneakers under $50', 'compare the lenovo and the acer', 'is the nitro good for gaming'])(
    'leaves "%s" to the model',
    async (message) => {
      expect(await tryFastPath(message, guest)).toBeNull();
    }
  );

  it('AI-04: a long message goes to the model even if it mentions a rule', async () => {
    const long = `is there tax? ${'and also tell me about your laptops '.repeat(4)}`;
    expect(long.length).toBeGreaterThan(120);
    expect(await tryFastPath(long, guest)).toBeNull();
  });

  it('greets a signed-in customer by name', async () => {
    expect((await tryFastPath('hi', alice))?.answer).toMatch(/^Hi Alice!/);
  });

  it('AI-05: order status depends on who is asking', async () => {
    const ask = (context: UserContext) =>
      tryFastPath('where is my order', context).then((r) => r?.answer);

    expect(await ask(guest)).toMatch(/Sign in/);
    expect(await ask({ ...alice, orders: 'No orders yet' })).toMatch(/haven't placed any orders/);
    expect(await ask({ ...alice, orders: '- #a1b2 Shipped, $120.00' })).toContain('#a1b2 Shipped');
  });

  it('reads back the cart, or says it is empty', async () => {
    expect((await tryFastPath("what's in my cart", alice))?.answer).toMatch(/empty/);
    expect(
      (await tryFastPath("what's in my cart", { ...alice, cart: '- Lamp x2' }))?.answer
    ).toContain('Lamp x2');
  });
});
