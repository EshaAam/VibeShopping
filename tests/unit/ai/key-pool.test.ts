/**
 * Failover behaviour of the Gemini key pool: a failure benches exactly the
 * thing it says is broken (key, key+model, or model), and the pool falls back
 * to the next key, then down the model chain.
 *
 * Includes a real production failure: the newer models returned 503 "high
 * demand" and the old pool spent its whole attempt budget on them, so
 * flash-lite was never tried and customers got the degraded answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Behaviour = (apiKey: string, model: string, signal?: AbortSignal) => string | Promise<string>;

const calls: string[] = [];
let behaviour: Behaviour = () => 'ok';

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor(private apiKey: string) {}
    getGenerativeModel({ model }: { model: string }) {
      const apiKey = this.apiKey;
      return {
        generateContent: async (_prompt: string, options?: { signal?: AbortSignal }) => {
          calls.push(`${apiKey}:${model}`);
          const text = await behaviour(apiKey, model, options?.signal);
          return { response: { text: () => text } };
        },
      };
    }
  },
}));

const LITE = 'gemini-3.5-flash-lite';
const FLASH = 'gemini-3.5-flash';
const NEWEST = 'gemini-3.6-flash';

/** Shaped like the SDK's GoogleGenerativeAIFetchError. */
function apiError(status: number, message: string, errorDetails?: unknown[]) {
  return Object.assign(new Error(message), { status, errorDetails });
}
const overloaded = () => {
  throw apiError(503, '[503 Service Unavailable] This model is currently experiencing high demand.');
};
const rateLimited = (seconds: number) => {
  throw apiError(429, '[429 Too Many Requests] RESOURCE_EXHAUSTED', [
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: `${seconds}s` },
  ]);
};
const dailyQuotaSpent = () => {
  throw apiError(429, '[429 Too Many Requests] quota exceeded', [
    {
      '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
      violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
    },
  ]);
};
const keyRejected = () => {
  throw apiError(400, 'API key not valid. Please pass a valid API key.');
};
const notFound = () => {
  throw apiError(404, '[404 Not Found] model is no longer available to new users');
};
const hangs = (signal?: AbortSignal) =>
  new Promise<string>((_, reject) =>
    signal?.addEventListener('abort', () => reject(new Error('aborted')))
  );

const modelsCalled = () => calls.map((c) => c.split(':')[1]);

async function loadPool() {
  // The pool keeps health state in module memory - load a fresh copy per test.
  vi.resetModules();
  return import('@/lib/ai/keyPool');
}

beforeEach(() => {
  calls.length = 0;
  behaviour = () => 'ok';
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-10-25T20:00:00Z')); // 13:00 Pacific
  vi.stubEnv('GEMINI_API_KEYS', 'k1,k2,k3');
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('GEMINI_MODELS', '');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('model fallback', () => {
  it('falls back down the model chain when a model is overloaded, one try per model', async () => {
    behaviour = (_, model) => (model === LITE ? 'hello from lite' : overloaded());
    const { generateWithFailover } = await loadPool();

    await expect(generateWithFailover('hi')).resolves.toBe('hello from lite');
    expect(modelsCalled()).toEqual([NEWEST, FLASH, LITE]);
  });

  it('keeps an overloaded model out with growing backoff, reset by a success', async () => {
    let newestUp = false;
    behaviour = (_, model) => (model === NEWEST && !newestUp ? overloaded() : 'ok');
    const { generateWithFailover, getPoolStatus } = await loadPool();
    const newest = () => getPoolStatus().models.find((m) => m.model === NEWEST)!;

    await generateWithFailover('1');
    expect(newest().benchedForSeconds).toBe(20);

    vi.advanceTimersByTime(21_000);
    await generateWithFailover('2'); // overloaded again -> 40s
    expect(newest().benchedForSeconds).toBe(40);
    expect(newest().consecutiveOverloads).toBe(2);

    vi.advanceTimersByTime(41_000);
    newestUp = true;
    calls.length = 0;
    await generateWithFailover('3');
    expect(modelsCalled()[0]).toBe(NEWEST);
    expect(newest().consecutiveOverloads).toBe(0);
  });

  it('treats a hung model as down and falls back after the attempt timeout', async () => {
    behaviour = (_, model, signal) => (model === NEWEST ? hangs(signal) : 'from flash');
    const { generateWithFailover } = await loadPool();

    const result = generateWithFailover('hi');
    await vi.advanceTimersByTimeAsync(15_000);

    await expect(result).resolves.toBe('from flash');
    expect(modelsCalled()).toEqual([NEWEST, FLASH]);
  });

  it('stops at the request deadline instead of hanging the chat', async () => {
    behaviour = (_, __, signal) => hangs(signal);
    const { generateWithFailover, AllKeysExhaustedError } = await loadPool();

    const result = generateWithFailover('hi');
    const assertion = expect(result).rejects.toBeInstanceOf(AllKeysExhaustedError);
    await vi.advanceTimersByTimeAsync(30_000);

    await assertion;
    expect(calls).toHaveLength(2); // 15s + the remaining 10s of a 25s budget
  });
});

describe('key fallback', () => {
  it('tries the next key when one is rate limited, since quota is per key', async () => {
    behaviour = (apiKey) => (apiKey === 'k3' ? 'third key had budget' : rateLimited(30));
    const { generateWithFailover } = await loadPool();

    await expect(generateWithFailover('hi')).resolves.toBe('third key had budget');
    expect(calls).toEqual([`k1:${NEWEST}`, `k2:${NEWEST}`, `k3:${NEWEST}`]);
  });

  it("respects Google's retryDelay for a rate-limited key and model", async () => {
    behaviour = (apiKey, model) => (apiKey === 'k1' && model === NEWEST ? rateLimited(7) : 'ok');
    const { generateWithFailover, getPoolStatus } = await loadPool();
    const key1 = () => getPoolStatus().keys[0].usable;

    await generateWithFailover('hi');
    expect(key1()).not.toContain(NEWEST);
    expect(key1()).toContain(FLASH); // only that model is benched for this key

    vi.advanceTimersByTime(8_000);
    expect(key1()).toContain(NEWEST);
  });

  it('benches a spent daily quota until the midnight Pacific reset', async () => {
    behaviour = (apiKey, model) => (apiKey === 'k1' && model === NEWEST ? dailyQuotaSpent() : 'ok');
    const { generateWithFailover, getPoolStatus } = await loadPool();
    const key1 = () => getPoolStatus().keys[0].usable;

    await generateWithFailover('hi');

    vi.setSystemTime(new Date('2026-10-26T06:30:00Z')); // 23:30 Pacific - still spent
    expect(key1()).not.toContain(NEWEST);

    vi.setSystemTime(new Date('2026-10-26T07:01:00Z')); // 00:01 Pacific - reset
    expect(key1()).toContain(NEWEST);
  });

  it('benches a rejected key for every model, not just the one that failed', async () => {
    behaviour = (apiKey) => (apiKey === 'k1' ? keyRejected() : 'ok');
    const { generateWithFailover, getPoolStatus } = await loadPool();

    await expect(generateWithFailover('hi')).resolves.toBe('ok');
    expect(calls).toEqual([`k1:${NEWEST}`, `k2:${NEWEST}`]);
    expect(getPoolStatus().keys[0].usable).toEqual([]);
  });

  it('retires a key+model pair for good on 404', async () => {
    behaviour = (apiKey, model) => (apiKey === 'k1' && model === NEWEST ? notFound() : 'ok');
    const { generateWithFailover, getPoolStatus } = await loadPool();

    await generateWithFailover('hi');
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);

    expect(getPoolStatus().keys[0].unavailable).toEqual([NEWEST]);
    expect(getPoolStatus().keys[0].usable).toEqual([FLASH, LITE]);
  });
});

describe('giving up', () => {
  it('does not retry a request every key would reject (safety block, bad prompt)', async () => {
    behaviour = () => {
      throw apiError(400, '[400 Bad Request] Request contains an invalid argument.');
    };
    const { generateWithFailover, AllKeysExhaustedError } = await loadPool();

    const error = await generateWithFailover('hi').catch((e) => e);
    expect(error).not.toBeInstanceOf(AllKeysExhaustedError);
    expect(calls).toHaveLength(1);
  });

  it('degrades with a trace that names keys by label, never by value', async () => {
    vi.stubEnv('GEMINI_API_KEYS', 'SECRET_A,SECRET_B,SECRET_C');
    behaviour = overloaded;
    const { generateWithFailover, AllKeysExhaustedError } = await loadPool();

    const error = await generateWithFailover('hi').catch((e) => e);
    expect(error).toBeInstanceOf(AllKeysExhaustedError);
    expect(error.message).toContain('key-1');
    expect(error.message).not.toContain('SECRET');
  });

  it('honours a model chain from GEMINI_MODELS', async () => {
    vi.stubEnv('GEMINI_MODELS', 'model-a, model-b');
    behaviour = (_, model) => (model === 'model-a' ? overloaded() : 'ok');
    const { generateWithFailover } = await loadPool();

    await generateWithFailover('hi');
    expect(modelsCalled()).toEqual(['model-a', 'model-b']);
  });
});
