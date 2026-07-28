/**
 * Gemini API Key Pool
 *
 * WHY: The free tier meters quota per project/key. Holding several keys and
 * failing over between them turns a hard 429 into an invisible retry, so the
 * deployed app never shows the user a rate-limit error.
 *
 * WHY per key+model cooldown: exhausting the flash quota on a key says nothing
 * about that key's flash-lite quota. Cooling down the pair keeps the remaining
 * capacity usable instead of benching the whole key.
 *
 * NOTE ON SERVERLESS: cooldown state lives in module memory, which on Vercel is
 * per warm lambda instance and is lost on cold start. That is fine here - the
 * worst case is one wasted request that re-discovers the 429 and fails over.
 * Correctness never depends on this map, only efficiency.
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

/** How long a key+model pair sits out after a quota rejection. */
const COOLDOWN_MS = 60_000;

/**
 * Models tried in order: newest first for answer quality, flash-lite last
 * because it has a higher free-tier ceiling and does no thinking, so it keeps
 * the bot alive and fast after the better models are spent for the day.
 *
 * WHY not 2.5: verified against all three keys, gemini-2.5-flash returns 404
 * "no longer available to new users" on keys created recently. The 3.x models
 * work on every key, old and new.
 */
const MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
] as const;

/** Ceiling on failover attempts so one request can never fan out unbounded. */
const MAX_ATTEMPTS = 6;

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

const KEYS = loadKeys();

/** Cached clients - constructing one per request is wasteful. */
const clients = new Map<string, GoogleGenerativeAI>();

/** `${key}::${model}` -> epoch ms until that pair is usable again. */
const cooldownUntil = new Map<string, number>();

/** `${key}::${model}` pairs the API has told us will never work. */
const unavailablePairs = new Set<string>();

/** Rotating start offset so load spreads across keys instead of hammering #1. */
let cursor = 0;

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

/** True when the pair is unusable right now, whether temporarily or for good. */
function isUnusable(apiKey: string, model: string): boolean {
  const pair = `${apiKey}::${model}`;
  if (unavailablePairs.has(pair)) return true;

  const until = cooldownUntil.get(pair);
  return until !== undefined && until > Date.now();
}

function markCoolingDown(apiKey: string, model: string): void {
  cooldownUntil.set(`${apiKey}::${model}`, Date.now() + COOLDOWN_MS);
}

/** Quota / rate-limit rejection - another key may still have budget. */
function isQuotaError(message: string): boolean {
  return (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('Too Many Requests') ||
    message.includes('RESOURCE_EXHAUSTED')
  );
}

/** Transient server-side failure - worth retrying elsewhere, not a quota issue. */
function isTransientError(message: string): boolean {
  return (
    message.includes('503') ||
    message.includes('500') ||
    message.includes('overloaded') ||
    message.includes('UNAVAILABLE') ||
    message.includes('fetch failed')
  );
}

/**
 * The model doesn't exist for THIS key.
 *
 * WHY this is its own case: Google gates older models by key age, so the same
 * model id can be fine on one key and 404 on another. That never changes, so
 * the pair is disabled permanently rather than cooled down - retrying it every
 * minute would waste an attempt slot on every request.
 */
function isModelUnavailableError(message: string): boolean {
  return (
    message.includes('404') ||
    message.includes('is no longer available') ||
    message.includes('NOT_FOUND')
  );
}

/** Bad or revoked key - benching it for the cooldown avoids repeat failures. */
function isAuthError(message: string): boolean {
  return (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('API key not valid') ||
    message.includes('PERMISSION_DENIED')
  );
}

/** Raised only when every key/model combination has been exhausted. */
export class AllKeysExhaustedError extends Error {
  constructor(message = 'All Gemini keys are rate-limited or unavailable') {
    super(message);
    this.name = 'AllKeysExhaustedError';
  }
}

/**
 * Build the attempt list: every model in preference order, and within each
 * model every key not currently cooling down, rotated by the cursor.
 */
function buildAttempts(): Array<{ apiKey: string; model: string }> {
  const attempts: Array<{ apiKey: string; model: string }> = [];

  for (const model of MODEL_CHAIN) {
    const rotated = KEYS.map(
      (_, index) => KEYS[(cursor + index) % KEYS.length]
    );
    for (const apiKey of rotated) {
      if (!isUnusable(apiKey, model)) {
        attempts.push({ apiKey, model });
      }
    }
  }

  // If everything is cooling down, try the pool anyway rather than hard-failing:
  // the cooldown is a heuristic and quota windows may have already reset.
  // Pairs known to be permanently unavailable stay excluded - retrying those is
  // guaranteed to fail.
  if (attempts.length === 0) {
    for (const model of MODEL_CHAIN) {
      for (const apiKey of KEYS) {
        if (!unavailablePairs.has(`${apiKey}::${model}`)) {
          attempts.push({ apiKey, model });
        }
      }
    }
  }

  return attempts.slice(0, MAX_ATTEMPTS);
}

/**
 * Generate a response, failing over across keys and models.
 *
 * @throws AllKeysExhaustedError when no key/model combination succeeded.
 */
export async function generateWithFailover(prompt: string): Promise<string> {
  if (KEYS.length === 0) {
    throw new AllKeysExhaustedError('No Gemini API keys configured');
  }

  const attempts = buildAttempts();
  let lastError: unknown;

  for (const { apiKey, model } of attempts) {
    try {
      const result = await modelFor(apiKey, model).generateContent(prompt);
      const text = result.response.text()?.trim();

      // An empty completion is usually a safety block - retrying the same
      // prompt on another key would just reproduce it, so stop here.
      if (!text) {
        throw new Error('Empty response from model');
      }

      // Advance the cursor only on success so the next request starts elsewhere.
      cursor = (cursor + 1) % KEYS.length;
      return text;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);

      if (isModelUnavailableError(message)) {
        unavailablePairs.add(`${apiKey}::${model}`);
        continue;
      }

      if (isQuotaError(message) || isAuthError(message)) {
        markCoolingDown(apiKey, model);
        continue;
      }

      if (isTransientError(message)) {
        continue;
      }

      // Anything else (malformed prompt, safety block) will fail identically on
      // every other key, so failing over is pointless.
      throw error;
    }
  }

  throw new AllKeysExhaustedError(
    lastError instanceof Error ? lastError.message : undefined
  );
}

/** True when at least one key is configured. */
export function isGeminiAvailable(): boolean {
  return KEYS.length > 0;
}

/** Pool health, for diagnostics. Never exposes the key material itself. */
export function getPoolStatus() {
  const now = Date.now();
  return {
    totalKeys: KEYS.length,
    keys: KEYS.map((key, index) => ({
      label: `key-${index + 1}`,
      // Last 4 characters only - enough to tell keys apart in a log.
      hint: `...${key.slice(-4)}`,
      usable: MODEL_CHAIN.filter((model) => !isUnusable(key, model)),
      unavailable: MODEL_CHAIN.filter((model) =>
        unavailablePairs.has(`${key}::${model}`)
      ),
    })),
    availablePairs: KEYS.flatMap((key) =>
      MODEL_CHAIN.filter((model) => !isUnusable(key, model))
    ).length,
    checkedAt: new Date(now).toISOString(),
  };
}
