/**
 * Turning a chat message into a product query. Only real catalog rows reach
 * the prompt, so this decides what the assistant can talk about.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('@/db/prisma', () => ({ prisma: { product: { findMany } } }));

import { parseQuery, retrieveProducts } from '@/lib/ai/retrieval';

const row = (name: string, price: string, stock = 5) => ({
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  brand: 'Brand',
  category: 'Category',
  price,
  stock,
  rating: '4.50',
  numReviews: 10,
});

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe('parseQuery', () => {
  it('AI-12: pulls out terms, a price ceiling and an in-stock filter', () => {
    expect(parseQuery('laptops under $500 in stock')).toEqual({
      // The number survives as a term; harmless, since terms are OR-ed and
      // the price-only retry covers a miss
      terms: ['laptops', '500'],
      maxPrice: 500,
      minPrice: null,
      inStockOnly: true,
    });
  });

  it('reads a price floor', () => {
    expect(parseQuery('headphones over $50.50')).toMatchObject({ minPrice: 50.5, maxPrice: null });
  });

  it('drops filler words and keeps at most six terms', () => {
    expect(parseQuery('can you show me the best cheap shoes please').terms).toEqual(['shoes']);
    expect(parseQuery('red blue green black white pink gold silver').terms).toHaveLength(6);
  });
});

describe('retrieveProducts', () => {
  it('does not query at all when there is nothing to search on', async () => {
    expect(await retrieveProducts('hello')).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1); // "hello" is a term

    findMany.mockClear();
    expect(await retrieveProducts('is it ok?')).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('never returns archived products', async () => {
    findMany.mockResolvedValue([]);
    await retrieveProducts('laptop');
    expect(findMany.mock.calls[0][0].where).toMatchObject({ archivedAt: null });
  });

  it('AI-13: a plural also searches its singular', async () => {
    findMany.mockResolvedValue([]);
    await retrieveProducts('shoes');

    const names = findMany.mock.calls[0][0].where.OR.map(
      (clause: { name?: { contains: string } }) => clause.name?.contains
    );
    expect(names).toEqual(expect.arrayContaining(['shoes', 'shoe']));
  });

  it('AI-14: falls back to price alone when the words match nothing', async () => {
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([row('Desk Lamp', '45.00')]);

    const products = await retrieveProducts('something nice under $100');

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1][0].where).toEqual({ price: { lte: 100 }, archivedAt: null });
    expect(products).toEqual([
      expect.objectContaining({ name: 'Desk Lamp', slug: 'desk-lamp', price: 45, rating: 4.5 }),
    ]);
  });

  it('asks only for in-stock rows when the customer does', async () => {
    findMany.mockResolvedValue([]);
    await retrieveProducts('lamps in stock');
    expect(findMany.mock.calls[0][0].where).toMatchObject({ stock: { gt: 0 } });
  });
});
