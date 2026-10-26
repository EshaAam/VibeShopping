/**
 * Sliding-window rate limiter, shared by the chat assistant and sign-in.
 *
 * NOTE ON SERVERLESS: attempts live in module memory, so on Vercel they are
 * per warm instance and vanish on cold start. That makes this a best-effort
 * brake rather than a hard guarantee - an attacker spread across instances
 * gets a higher effective limit. Swapping the Map for Redis is the only change
 * needed if that ever matters; callers stay the same.
 */

export interface RateLimit {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** `${bucket}:${identity}` -> timestamps of recent attempts. */
const attemptLog = new Map<string, number[]>();

/**
 * Record an attempt and report whether it is allowed. `bucket` keeps
 * unrelated limits apart, so chat messages never count against sign-in.
 */
export function checkRateLimit(
  bucket: string,
  identity: string,
  limits: RateLimit[]
): RateLimitResult {
  const key = `${bucket}:${identity}`;
  const now = Date.now();
  const longestWindow = Math.max(...limits.map((limit) => limit.windowMs));

  const history = (attemptLog.get(key) ?? []).filter(
    (timestamp) => now - timestamp < longestWindow
  );

  for (const limit of limits) {
    const inWindow = history.filter((t) => now - t < limit.windowMs);
    if (inWindow.length >= limit.max) {
      const oldest = Math.min(...inWindow);
      const retryAfterSeconds = Math.ceil(
        (limit.windowMs - (now - oldest)) / 1000
      );
      // Persist the pruned history so the map doesn't grow unbounded.
      attemptLog.set(key, history);
      return { allowed: false, retryAfterSeconds };
    }
  }

  history.push(now);
  attemptLog.set(key, history);

  // Opportunistic sweep - keeps a long-lived instance from accumulating
  // entries for visitors who never came back.
  if (attemptLog.size > 1000) {
    for (const [entry, timestamps] of attemptLog) {
      if (timestamps.every((t) => now - t >= longestWindow)) {
        attemptLog.delete(entry);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
