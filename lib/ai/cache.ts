/**
 * Response Cache and Rate Limiter
 *
 * WHY: The free tier is capped by requests, not by tokens. Two cheap guards buy
 * back most of the budget - never answer the same generic question twice, and
 * never let one visitor drain the daily quota.
 *
 * NOTE ON SERVERLESS: both maps live in module memory, so on Vercel they are
 * per warm instance and vanish on cold start. That makes this a best-effort
 * optimisation rather than a hard guarantee: a cache miss costs one extra API
 * call, and a determined abuser spread across instances gets a higher effective
 * limit. Swapping the two Maps for Upstash Redis is the only change needed if
 * that ever matters - the call sites stay identical.
 */

interface CacheEntry {
  answer: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
/** Bounded so a warm instance can't grow its heap without limit. */
const CACHE_MAX_ENTRIES = 200;

const responseCache = new Map<string, CacheEntry>();

/**
 * Normalise so trivial variations share a cache slot:
 * "Do you have Nike shoes?" and "do you have nike shoes" are one question.
 */
function cacheKey(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCachedResponse(message: string): string | null {
  const entry = responseCache.get(cacheKey(message));
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey(message));
    return null;
  }

  return entry.answer;
}

export function setCachedResponse(message: string, answer: string): void {
  // Map preserves insertion order, so the first key is the oldest.
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }

  responseCache.set(cacheKey(message), {
    answer,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/** Sliding-window limits per visitor. */
const LIMITS = [
  { windowMs: 60 * 1000, max: 5 },
  { windowMs: 60 * 60 * 1000, max: 20 },
];

const requestLog = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Record an attempt and report whether it is allowed.
 * Only called for requests that would actually hit Gemini - cached and
 * fast-path answers are free and shouldn't count against anyone.
 */
export function checkRateLimit(identity: string): RateLimitResult {
  const now = Date.now();
  const longestWindow = Math.max(...LIMITS.map((limit) => limit.windowMs));

  const history = (requestLog.get(identity) ?? []).filter(
    (timestamp) => now - timestamp < longestWindow
  );

  for (const limit of LIMITS) {
    const inWindow = history.filter((t) => now - t < limit.windowMs);
    if (inWindow.length >= limit.max) {
      const oldest = Math.min(...inWindow);
      const retryAfterSeconds = Math.ceil(
        (limit.windowMs - (now - oldest)) / 1000
      );
      // Persist the pruned history so the map doesn't grow unbounded.
      requestLog.set(identity, history);
      return { allowed: false, retryAfterSeconds };
    }
  }

  history.push(now);
  requestLog.set(identity, history);

  // Opportunistic sweep - keeps a long-lived instance from accumulating
  // entries for visitors who never came back.
  if (requestLog.size > 500) {
    for (const [key, timestamps] of requestLog) {
      if (timestamps.every((t) => now - t >= longestWindow)) {
        requestLog.delete(key);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
