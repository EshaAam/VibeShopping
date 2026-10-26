/**
 * Every product link the assistant sends must resolve. Known slugs pass,
 * near-misses are repaired (the model "fixing" the real lenevo-legion slug),
 * anything else is removed and the line tidied.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeProductLinks } from '@/lib/ai/linkGuard';
import type { RetrievedProduct } from '@/lib/ai/retrieval';

const products = ['lenevo-legion', 'acer-nitro-v16'].map(
  (slug) => ({ slug }) as RetrievedProduct
);

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('sanitizeProductLinks', () => {
  it('AI-15: leaves a known link untouched', () => {
    const text = 'Lenovo Legion - $1500 - /product/lenevo-legion';
    expect(sanitizeProductLinks(text, products)).toBe(text);
  });

  it('AI-15: repairs a slug the model "corrected"', () => {
    expect(sanitizeProductLinks('See /product/lenovo-legion', products)).toBe(
      'See /product/lenevo-legion'
    );
  });

  it('AI-15: drops an invented link and the separator that introduced it', () => {
    expect(
      sanitizeProductLinks('Acer Nitro for $1420.00: /product/macbook-pro-m5', products)
    ).toBe('Acer Nitro for $1420.00');
  });

  it('AI-15: drops a link inside parentheses without leaving "()"', () => {
    expect(sanitizeProductLinks('A lamp (/product/brass-lamp) is great', products)).toBe(
      'A lamp is great'
    );
  });

  it('AI-16: with nothing retrieved, every product link goes', () => {
    expect(sanitizeProductLinks('Try /product/lenevo-legion', [])).toBe('Try');
  });

  it('AI-17: only tidies lines a link was removed from', () => {
    const text = 'We have these in stock:\n- Brass lamp: /product/brass-lamp';
    expect(sanitizeProductLinks(text, products)).toBe(
      'We have these in stock:\n- Brass lamp'
    );
  });

  it('leaves non-product links alone', () => {
    const text = 'Track it at /user/orders';
    expect(sanitizeProductLinks(text, products)).toBe(text);
  });
});
