/**
 * Gemini API Key Pool
 *
 * WHY: The free tier meters quota per project/key. Holding several keys and
 * failing over between them turns a hard 429 into an invisible retry, so the
 * deployed app never shows the user a rate-limit error.
 *
 * HOW FAILOVER WORKS
 * Models are tried best-first. Within a model, every healthy key is tried in
 * rotation; when a model can't answer, we fall back to the next model in the
 * chain. Each failure is classified by WHAT it says is broken, and only that
 * thing is benched - a dead key, a spent quota and an overloaded model need
 * different responses:
 *
 *   failure                          broken thing   response
 *   401 / 403 / invalid key          the key        bench the key for every model
 *   429 per-minute limit             key + model    bench for Google's retryDelay
 *   429 per-day quota                key + model    bench until the daily reset
 *   404 model not on this key        key + model    bench for good
 *   503 / 500 / timeout / network    the model      fall back to the next model,
 *                                                   bench it with growing backoff
 *   400 / safety block / empty       the request    stop - every key fails alike
 *
 * NOTE ON SERVERLESS: all health state lives in module memory, which on Vercel
 * is per warm lambda instance and is lost on cold start. That is fine here -
 * the worst case is one wasted request that re-discovers a failure and fails
 * over. Correctness never depends on this state, only efficiency.
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

/**
 * Models tried in order: newest first for answer quality, flash-lite last
 * because it has a higher free-tier ceiling and does no thinking, so it keeps
 * the bot alive and fast after the better models are spent for the day.
 * Override with GEMINI_MODELS (comma separated) without a code change.
 *
 * WHY not 2.5: verified against all three keys, gemini-2.5-flash returns 404
 * "no longer available to new users" on keys created recently. The 3.x models
 * work on every key, old and new.
 */
const DEFAULT_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

/** Ceiling on failover attempts so one request can never fan out unbounded. */
const MAX_ATTEMPTS = 6;

/** One attempt may not hang the request - a slow model is treated as down. */
const ATTEMPT_TIMEOUT_MS = 15_000;

/** Total time budget for one request, across every attempt. */
const REQUEST_DEADLINE_MS = 25_000;

/** Not worth starting an attempt with less time than this left. */
const MIN_ATTEMPT_MS = 3_000;

/** Per-minute 429 without a retryDelay from Google. */
const RATE_LIMIT_COOLDOWN_MS = 60_000;

/** A rejected key is likely revoked or mistyped - check again later, not soon. */
const AUTH_COOLDOWN_MS = 10 * 60_000;

/** Overload backoff: 20s, 40s, 80s ... capped, reset by the next success. */
const OVERLOAD_BASE_MS = 20_000;
const OVERLOAD_MAX_MS = 5 * 60_000;

/**
 * Read keys from GEMINI_API_KEYS (comma separated) and fall back to the legacy
 * single GEMINI_API_KEY so existing deployments keep working either way.
 */
function loadKeys(): string[] {
  const raw = [process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY]
    .filter(Boolean)
    .join(',');

  const parsed = raw
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  // Dedupe in case the same key appears in both env vars.
  return [...new Set(parsed)];
}

function loadModels(): string[] {
  const configured = (process.env.GEMINI_MODELS ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0);

  return configured.length > 0 ? configured : DEFAULT_MODEL_CHAIN;
}

const KEYS = loadKeys();
const MODEL_CHAIN = loadModels();

// ---- Health state ---------------------------------------------------------

/** Cached clients - constructing one per request is wasteful. */
const clients = new Map<string, GoogleGenerativeAI>();

/** key -> epoch ms until the key is trusted again (auth failures). */
const keyBenchedUntil = new Map<string, number>();

/** `${key}::${model}` -> epoch ms until that pair has quota again. */
const pairBenchedUntil = new Map<string, number>();

/** `${key}::${model}` pairs the API has told us will never work. */
const deadPairs = new Set<string>();

/** model -> epoch ms until it is worth trying again after an overload. */
const modelBenchedUntil = new Map<string, number>();

/** model -> consecutive overloads, driving the exponential backoff. */
const modelStrikes = new Map<string, number>();

/** Rotating start offset so load spreads across keys instead of hammering #1. */
let cursor = 0;

const pairId = (apiKey: string, model: string) => `${apiKey}::${model}`;

/** Logs and errors name keys by position, never by their value. */
const keyLabel = (apiKey: string) => `key-${KEYS.indexOf(apiKey) + 1}`;

const isBenched = (map: Map<string, number>, id: string, now: number) =>
  (map.get(id) ?? 0) > now;

function isHealthy(apiKey: string, model: string, now: number): boolean {
  return (
    !deadPairs.has(pairId(apiKey, model)) &&
    !isBenched(keyBenchedUntil, apiKey, now) &&
    !isBenched(pairBenchedUntil, pairId(apiKey, model), now) &&
    !isBenched(modelBenchedUntil, model, now)
  );
}

function clientFor(apiKey: string): GoogleGenerativeAI {
  let client = clients.get(apiKey);
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
    clients.set(apiKey, client);
  }
  return client;
}

function modelFor(apiKey: string, model: string): GenerativeModel {
  return clientFor(apiKey).getGenerativeModel({
    model,
    generationConfig: {
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
      // 2048, not 1024: the 3.x models are thinking models and spend several
      // hundred internal tokens before writing. Measured ~400 thinking tokens
      // for a one-line answer, so a tight cap risks truncated replies.
      maxOutputTokens: 2048,
    },
  });
}

// ---- Failure classification -----------------------------------------------

type Failure =
  | { scope: 'key'; reason: string }
  | { scope: 'pair'; reason: string; benchMs: number }
  | { scope: 'dead-pair'; reason: string }
  | { scope: 'model'; reason: string }
  | { scope: 'request'; reason: string };

class AttemptTimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms}ms`);
    this.name = 'AttemptTimeoutError';
  }
}

type ErrorDetail = { '@type'?: string; [key: string]: unknown };

/** The SDK's fetch errors carry an HTTP status and Google's error details. */
function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
}

function detailsOf(error: unknown): ErrorDetail[] {
  const details = (error as { errorDetails?: unknown })?.errorDetails;
  return Array.isArray(details) ? details : [];
}

/** How long Google asked us to wait, from RetryInfo or the message text. */
function retryDelayMs(error: unknown, message: string): number | undefined {
  const retryInfo = detailsOf(error).find((d) => d['@type']?.includes('RetryInfo'));
  const fromDetails = typeof retryInfo?.retryDelay === 'string' ? retryInfo.retryDelay : '';
  const seconds = parseFloat(fromDetails) || parseFloat(/retry in ([\d.]+)s/i.exec(message)?.[1] ?? '');
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : undefined;
}

/** Daily quotas are named "...PerDay..." in Google's QuotaFailure details. */
function isDailyQuota(error: unknown, message: string): boolean {
  return /per ?day/i.test(message) || JSON.stringify(detailsOf(error)).includes('PerDay');
}

/**
 * Gemini's daily quotas reset at midnight Pacific time. Retrying a spent daily
 * quota every minute would waste an attempt slot on every request all day.
 * Off by up to an hour on DST changeover days, which only costs one extra 429.
 */
function msUntilDailyReset(now: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const elapsed = ((part('hour') * 60 + part('minute')) * 60 + part('second')) * 1000;
  return 24 * 60 * 60 * 1000 - elapsed;
}

function classify(error: unknown, now: number): Failure {
  const message = error instanceof Error ? error.message : String(error);
  const status = statusOf(error);

  if (error instanceof AttemptTimeoutError) {
    return { scope: 'model', reason: 'timeout' };
  }

  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/.test(message)) {
    return { scope: 'key', reason: 'key rejected' };
  }

  if (status === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota|Too Many Requests/i.test(message)) {
    return isDailyQuota(error, message)
      ? { scope: 'pair', reason: 'daily quota spent', benchMs: msUntilDailyReset(now) }
      : {
          scope: 'pair',
          reason: 'rate limited',
          benchMs: retryDelayMs(error, message) ?? RATE_LIMIT_COOLDOWN_MS,
        };
  }

  // Google gates older models by key age, so the same model id can be fine on
  // one key and 404 on another - and that never changes.
  if (status === 404 || /NOT_FOUND|no longer available/.test(message)) {
    return { scope: 'dead-pair', reason: 'model not available on this key' };
  }

  // Overload is about Google's capacity for the model, so every key would get
  // the same answer - fall back to the next model instead of the next key.
  if (
    (status !== undefined && status >= 500) ||
    /\b50[0-4]\b|overloaded|UNAVAILABLE|high demand|fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(message)
  ) {
    return { scope: 'model', reason: 'overloaded' };
  }

  // Malformed prompt, safety block, empty answer: identical on every key.
  return { scope: 'request', reason: message.slice(0, 80) };
}

/** Record a failure against exactly the thing it says is broken. */
function bench(failure: Failure, apiKey: string, model: string, now: number): void {
  switch (failure.scope) {
    case 'key':
      keyBenchedUntil.set(apiKey, now + AUTH_COOLDOWN_MS);
      break;
    case 'pair':
      pairBenchedUntil.set(pairId(apiKey, model), now + failure.benchMs);
      break;
    case 'dead-pair':
      deadPairs.add(pairId(apiKey, model));
      break;
    case 'model': {
      const strikes = (modelStrikes.get(model) ?? 0) + 1;
      modelStrikes.set(model, strikes);
      const backoff = Math.min(OVERLOAD_BASE_MS * 2 ** (strikes - 1), OVERLOAD_MAX_MS);
      modelBenchedUntil.set(model, now + backoff);
      break;
    }
  }
}

// ---- Planning and execution -----------------------------------------------

/** Raised only when every key/model combination has been exhausted. */
export class AllKeysExhaustedError extends Error {
  constructor(message = 'All Gemini keys are rate-limited or unavailable') {
    super(message);
    this.name = 'AllKeysExhaustedError';
  }
}

type Attempt = { apiKey: string; model: string };

/**
 * Best model first; within a model, every healthy key in rotation. If nothing
 * is healthy, try every pair that isn't known-dead anyway: cooldowns are
 * estimates, and a quota window may already have reset.
 */
function plan(now: number): Attempt[] {
  const rotatedKeys = KEYS.map((_, index) => KEYS[(cursor + index) % KEYS.length]);

  const healthy = MODEL_CHAIN.flatMap((model) =>
    rotatedKeys
      .filter((apiKey) => isHealthy(apiKey, model, now))
      .map((apiKey) => ({ apiKey, model }))
  );
  if (healthy.length > 0) return healthy;

  return MODEL_CHAIN.flatMap((model) =>
    rotatedKeys
      .filter(
        (apiKey) =>
          !deadPairs.has(pairId(apiKey, model)) &&
          !isBenched(keyBenchedUntil, apiKey, now)
      )
      .map((apiKey) => ({ apiKey, model }))
  );
}

/** One generateContent call that can't outlive its time slot. */
async function attempt({ apiKey, model }: Attempt, prompt: string, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AttemptTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      modelFor(apiKey, model).generateContent(prompt, { signal: controller.signal }),
      timeout,
    ]);
    return result.response.text()?.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate a response, failing over across keys and then down the model chain.
 *
 * @throws AllKeysExhaustedError when no key/model combination succeeded, so
 *   the caller can degrade to a database-only answer.
 */
export async function generateWithFailover(prompt: string): Promise<string> {
  if (KEYS.length === 0) {
    throw new AllKeysExhaustedError('No Gemini API keys configured');
  }

  const started = Date.now();
  const trace: string[] = [];
  // Within one request, don't retry what this request already found broken.
  const failedKeys = new Set<string>();
  const failedModels = new Set<string>();
  let made = 0;

  for (const next of plan(started)) {
    if (failedKeys.has(next.apiKey) || failedModels.has(next.model)) continue;

    const remaining = REQUEST_DEADLINE_MS - (Date.now() - started);
    if (made >= MAX_ATTEMPTS || remaining < MIN_ATTEMPT_MS) break;
    made++;

    try {
      const text = await attempt(next, prompt, Math.min(ATTEMPT_TIMEOUT_MS, remaining));

      // An empty completion is usually a safety block - retrying the same
      // prompt on another key would just reproduce it, so stop here.
      if (!text) throw new Error('Empty response from model');

      // Advance the cursor only on success so the next request starts elsewhere.
      cursor = (cursor + 1) % KEYS.length;
      modelStrikes.delete(next.model);

      if (trace.length > 0) {
        console.info(
          `[gemini] answered by ${next.model} (${keyLabel(next.apiKey)}) after: ${trace.join('; ')}`
        );
      }
      return text;
    } catch (error) {
      const failure = classify(error, Date.now());
      trace.push(`${next.model} (${keyLabel(next.apiKey)}): ${failure.reason}`);

      if (failure.scope === 'request') throw error;

      bench(failure, next.apiKey, next.model, Date.now());
      if (failure.scope === 'key') failedKeys.add(next.apiKey);
      if (failure.scope === 'model') failedModels.add(next.model);
    }
  }

  throw new AllKeysExhaustedError(
    trace.length > 0
      ? `All Gemini attempts failed: ${trace.join('; ')}`
      : 'No Gemini key/model pair is currently usable'
  );
}

/** True when at least one key is configured. */
export function isGeminiAvailable(): boolean {
  return KEYS.length > 0;
}

/** Pool health, for diagnostics. Never exposes the key material itself. */
export function getPoolStatus() {
  const now = Date.now();
  const secondsLeft = (until: number | undefined) =>
    until && until > now ? Math.ceil((until - now) / 1000) : 0;

  return {
    models: MODEL_CHAIN.map((model) => ({
      model,
      benchedForSeconds: secondsLeft(modelBenchedUntil.get(model)),
      consecutiveOverloads: modelStrikes.get(model) ?? 0,
    })),
    keys: KEYS.map((key) => ({
      label: keyLabel(key),
      // Last 4 characters only - enough to tell keys apart in a log.
      hint: `...${key.slice(-4)}`,
      benchedForSeconds: secondsLeft(keyBenchedUntil.get(key)),
      usable: MODEL_CHAIN.filter((model) => isHealthy(key, model, now)),
      unavailable: MODEL_CHAIN.filter((model) => deadPairs.has(pairId(key, model))),
    })),
    checkedAt: new Date(now).toISOString(),
  };
}
