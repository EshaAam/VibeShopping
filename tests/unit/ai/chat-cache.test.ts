/**
 * The chat response cache and per-visitor rate limit. Both keep state in module
 * memory, so each test loads a fresh copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function load() {
  vi.resetModules();
  return import('@/lib/ai/cache');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('response cache', () => {
  it('AI-06: trivially different phrasings share one entry', async () => {
    const { getCachedResponse, setCachedResponse } = await load();
    setCachedResponse('Do you have Nike shoes?', 'Yes, three pairs.');

    expect(getCachedResponse('do you have   nike shoes')).toBe('Yes, three pairs.');
    expect(getCachedResponse('do you have adidas shoes')).toBeNull();
  });

  it('AI-08: entries expire after an hour', async () => {
    const { getCachedResponse, setCachedResponse } = await load();
    setCachedResponse('what laptops are there', 'Two.');

    vi.advanceTimersByTime(59 * 60 * 1000);
    expect(getCachedResponse('what laptops are there')).toBe('Two.');

    vi.advanceTimersByTime(60 * 1000);
    expect(getCachedResponse('what laptops are there')).toBeNull();
  });

  it('AI-08: the 201st entry evicts the oldest, nothing else', async () => {
    const { getCachedResponse, setCachedResponse } = await load();
    for (let i = 0; i < 200; i++) setCachedResponse(`question ${i}`, `answer ${i}`);

    setCachedResponse('question 200', 'answer 200');

    expect(getCachedResponse('question 0')).toBeNull();
    expect(getCachedResponse('question 1')).toBe('answer 1');
    expect(getCachedResponse('question 200')).toBe('answer 200');
  });

  // Regression: cacheKey used to strip every non a-z character, so all Bangla
  // messages normalised to "" and shared one slot.
  it('AI-09: two different Bangla questions get different answers', async () => {
    const { getCachedResponse, setCachedResponse } = await load();
    setCachedResponse('ল্যাপটপ আছে?', 'Laptop answer');

    expect(getCachedResponse('জুতার দাম কত?')).toBeNull();
    expect(getCachedResponse('ল্যাপটপ আছে')).toBe('Laptop answer');
  });

  it('AI-09: a message with nothing to key on (only emoji) is never cached', async () => {
    const { getCachedResponse, setCachedResponse } = await load();
    setCachedResponse('👍', 'Glad to help!');

    expect(getCachedResponse('😡')).toBeNull();
    expect(getCachedResponse('👍')).toBeNull();
  });
});

describe('rate limit', () => {
  const browser = (visitor: string, ip = '1.1.1.1') => ({ visitor, ip });

  it('AI-10: the 6th message within a minute is refused until the window clears', async () => {
    const { checkRateLimit } = await load();
    for (let i = 0; i < 5; i++) expect(checkRateLimit(browser('visitor')).allowed).toBe(true);

    expect(checkRateLimit(browser('visitor'))).toEqual({ allowed: false, retryAfterSeconds: 60 });

    vi.advanceTimersByTime(30_000);
    expect(checkRateLimit(browser('visitor'))).toEqual({ allowed: false, retryAfterSeconds: 30 });

    vi.advanceTimersByTime(30_000);
    expect(checkRateLimit(browser('visitor')).allowed).toBe(true);
  });

  it('AI-10: the 21st message within an hour is refused even when spread out', async () => {
    const { checkRateLimit } = await load();
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(browser('visitor')).allowed).toBe(true);
      vi.advanceTimersByTime(61_000);
    }

    // First message was 20 * 61s = 1220s ago; it leaves the hour in 2380s
    expect(checkRateLimit(browser('visitor'))).toEqual({
      allowed: false,
      retryAfterSeconds: 2380,
    });
  });

  it('limits each visitor separately', async () => {
    const { checkRateLimit } = await load();
    for (let i = 0; i < 5; i++) checkRateLimit(browser('visitor-a'));

    expect(checkRateLimit(browser('visitor-a')).allowed).toBe(false);
    expect(checkRateLimit(browser('visitor-b')).allowed).toBe(true);
  });

  it('caps a network that sends a new cookie with every message', async () => {
    const { checkRateLimit } = await load();
    for (let i = 0; i < 15; i++) {
      expect(checkRateLimit(browser(`forged-${i}`, '6.6.6.6')).allowed).toBe(true);
    }

    expect(checkRateLimit(browser('forged-16', '6.6.6.6')).allowed).toBe(false);
    expect(checkRateLimit(browser('honest', '8.8.8.8')).allowed).toBe(true);
  });

  it('a visitor over their own limit does not use up their network’s allowance', async () => {
    const { checkRateLimit } = await load();
    for (let i = 0; i < 20; i++) checkRateLimit(browser('spammer', '10.0.0.1'));

    // Spammer got 5 through; the office still has 10 left this minute
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(browser(`colleague-${i}`, '10.0.0.1')).allowed).toBe(true);
    }
  });

  it('a browser without a cookie is limited by its network alone', async () => {
    const { checkRateLimit } = await load();
    for (let i = 0; i < 15; i++) checkRateLimit({ ip: '1.1.1.1' });

    expect(checkRateLimit({ ip: '1.1.1.1' }).allowed).toBe(false);
    expect(checkRateLimit({ ip: '2.2.2.2' }).allowed).toBe(true);
  });
});
