/**
 * URL params are user input. "/search?page=abc", "?page=-1" and "?price=abc"
 * used to reach Prisma as NaN or a negative skip and crash the search page.
 */
import { describe, expect, it } from 'vitest';
import { parsePage, parsePriceRange } from '@/lib/utils';

describe('parsePage', () => {
  it.each([
    ['1', 1],
    ['3', 3],
    ['2.7', 2],
    [7, 7],
  ])('keeps a valid page %j as %i', (input, expected) => {
    expect(parsePage(input)).toBe(expected);
  });

  it.each(['abc', '-1', '0', '', undefined, null, 'Infinity', '1e999'])(
    'falls back to page 1 for %j',
    (input) => {
      expect(parsePage(input)).toBe(1);
    }
  );
});

describe('parsePriceRange', () => {
  it('reads a "min-max" range', () => {
    expect(parsePriceRange('100-500')).toEqual({ min: 100, max: 500 });
    expect(parsePriceRange('9.99-19.5')).toEqual({ min: 9.99, max: 19.5 });
  });

  it.each(['abc', '10-', '-10', '500-100', '1-2-3', 'all', '', undefined])(
    'ignores a malformed range %j',
    (input) => {
      expect(parsePriceRange(input)).toBeNull();
    }
  );
});
