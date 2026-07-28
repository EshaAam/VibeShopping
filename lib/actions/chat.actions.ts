'use server';

/**
 * Chat Server Actions
 *
 * WHY Server Actions:
 * - Keeps API keys secure (never sent to client)
 * - Runs on server, reducing client bundle size
 * - Follows Next.js 15 best practices
 * - Provides type-safe mutations
 *
 * REQUEST PIPELINE - each stage answers for free where it can, so Gemini is
 * only reached for questions that genuinely need it:
 *   1. validate input
 *   2. fast path      - deterministic answers from code and DB, no quota used
 *   3. response cache - identical generic questions reuse the last answer
 *   4. rate limit     - one visitor cannot drain the daily quota
 *   5. retrieval      - live product rows injected into the prompt
 *   6. key pool       - fails over across keys and models on 429
 *   7. degraded reply - if every key is spent, answer from the DB rows alone
 * Stage 7 is why a quota error should never reach the customer in production.
 */

import { cookies } from 'next/headers';
import { buildPrompt, type ChatTurn } from '@/lib/ai/systemPrompt';
import { tryFastPath } from '@/lib/ai/fastPath';
import { sanitizeProductLinks } from '@/lib/ai/linkGuard';
import {
  AllKeysExhaustedError,
  generateWithFailover,
  isGeminiAvailable,
} from '@/lib/ai/keyPool';
import {
  formatCatalog,
  formatProducts,
  getCatalogSummary,
  retrieveProducts,
} from '@/lib/ai/retrieval';
import {
  formatUserContext,
  getUserContext,
  isPersonalQuestion,
  type UserContext,
} from '@/lib/ai/userContext';
import {
  checkRateLimit,
  getCachedResponse,
  setCachedResponse,
} from '@/lib/ai/cache';

const MAX_MESSAGE_LENGTH = 500;

/** Trusted only for phrasing context, so a modest cap is enough. */
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_CONTENT_LENGTH = 500;

// Type for chat response
export interface ChatResponse {
  success: boolean;
  message: string;
  error?: string;
  /** Which pipeline stage produced the answer. Useful when debugging quota use. */
  source?: 'fast-path' | 'cache' | 'ai' | 'degraded';
}

const EMPTY_CONTEXT: UserContext = {
  isSignedIn: false,
  name: null,
  cart: null,
  orders: null,
};

/**
 * History arrives from the client, so treat it as untrusted: clamp the length,
 * clamp each message, and drop anything that isn't a recognised turn.
 */
function sanitizeHistory(history: unknown): ChatTurn[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (turn): turn is ChatTurn =>
        typeof turn === 'object' &&
        turn !== null &&
        (turn as ChatTurn).role !== undefined &&
        ((turn as ChatTurn).role === 'user' ||
          (turn as ChatTurn).role === 'assistant') &&
        typeof (turn as ChatTurn).content === 'string'
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
    }));
}

/**
 * Last-resort answer built purely from database rows.
 * WHY: when every key is rate-limited the customer should still get something
 * true and useful rather than an error bubble.
 */
function degradedAnswer(products: Awaited<ReturnType<typeof retrieveProducts>>) {
  if (products.length === 0) {
    return "I'm having trouble reaching my assistant service right now. You can still search the store directly, or try me again in a minute.";
  }

  return `I'm running slow right now, but here's what I found in the catalog:\n${formatProducts(products)}`;
}

/**
 * Send a message to the AI assistant
 *
 * @param userMessage - The user's question or message
 * @param history - Recent turns, so follow-up questions keep their context
 * @returns ChatResponse with success status and AI response
 */
export async function sendChatMessage(
  userMessage: string,
  history: unknown = []
): Promise<ChatResponse> {
  // ---- 1. Validate input -------------------------------------------------
  if (!userMessage || typeof userMessage !== 'string') {
    return { success: false, message: '', error: 'Please enter a message.' };
  }

  const trimmedMessage = userMessage.trim();
  if (trimmedMessage.length === 0) {
    return { success: false, message: '', error: 'Please enter a message.' };
  }

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return {
      success: false,
      message: '',
      error: `Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }

  try {
    const isPersonal = isPersonalQuestion(trimmedMessage);

    // Personal questions need the cart/order lookup; generic ones skip it,
    // which keeps the prompt smaller and the answer cacheable.
    const userContext = isPersonal ? await getUserContext() : EMPTY_CONTEXT;

    // ---- 2. Fast path - free, instant ------------------------------------
    const fastPath = await tryFastPath(trimmedMessage, userContext);
    if (fastPath) {
      return { success: true, message: fastPath.answer, source: 'fast-path' };
    }

    // ---- 3. Cache - generic questions only -------------------------------
    // Personal answers are never cached: one customer's order status must not
    // be replayed to the next visitor asking the same way.
    if (!isPersonal) {
      const cached = getCachedResponse(trimmedMessage);
      if (cached) {
        return { success: true, message: cached, source: 'cache' };
      }
    }

    // ---- 4. Retrieval - live catalog rows --------------------------------
    const products = await retrieveProducts(trimmedMessage);

    // The store overview is only worth its tokens when nothing matched and the
    // model needs something to steer the customer towards.
    const catalog =
      products.length === 0 ? formatCatalog(await getCatalogSummary()) : null;

    if (!isGeminiAvailable()) {
      console.error('[chat] no Gemini API keys configured');
      return {
        success: true,
        message: degradedAnswer(products),
        source: 'degraded',
      };
    }

    // ---- 5. Rate limit - only for calls that reach Gemini -----------------
    const sessionCartId = (await cookies()).get('sessionCartId')?.value;
    const identity = sessionCartId ?? 'anonymous';
    const rateLimit = checkRateLimit(identity);

    if (!rateLimit.allowed) {
      return {
        success: true,
        message: `You're sending messages a bit quickly - give me about ${rateLimit.retryAfterSeconds} seconds and ask again.`,
        source: 'degraded',
      };
    }

    // ---- 6. Generate, failing over across keys and models -----------------
    const prompt = buildPrompt({
      userMessage: trimmedMessage,
      history: sanitizeHistory(history),
      products,
      catalog,
      userContext: isPersonal ? formatUserContext(userContext) : null,
    });

    const raw = await generateWithFailover(prompt);

    // Never hand the customer a link the catalog can't resolve - the model
    // rewrites slugs it mistakes for typos. Sanitise before caching, so a bad
    // link can't be stored and replayed.
    const text = sanitizeProductLinks(raw, products);

    if (!isPersonal) {
      setCachedResponse(trimmedMessage, text);
    }

    return { success: true, message: text, source: 'ai' };
  } catch (error) {
    console.error('[chat] error:', error);

    // ---- 7. Degrade rather than fail -------------------------------------
    if (error instanceof AllKeysExhaustedError) {
      // Re-run retrieval so the fallback still names real, in-stock products.
      // It is a plain DB query, so it works even with zero quota left.
      try {
        const products = await retrieveProducts(userMessage.trim());
        return {
          success: true,
          message: degradedAnswer(products),
          source: 'degraded',
        };
      } catch {
        return {
          success: true,
          message: degradedAnswer([]),
          source: 'degraded',
        };
      }
    }

    return {
      success: false,
      message: '',
      error: 'Something went wrong. Please try again.',
    };
  }
}
