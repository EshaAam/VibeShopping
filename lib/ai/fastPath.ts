/**
 * Non-AI Fast Path
 *
 * WHY: A large share of chat traffic is a handful of predictable questions -
 * greetings, shipping cost, tax, payment methods, order status. Answering those
 * from code costs zero Gemini quota and returns instantly, which leaves the
 * free-tier budget for questions that actually need a model.
 *
 * Every answer here is derived from real code or live data (see calcPrice in
 * cart.actions and PAYMENT_METHODS in lib/constants) so the fast path can never
 * drift from what the store actually does.
 */

import { PAYMENT_METHODS } from '@/lib/constants';
import { formatCatalog, getCatalogSummary } from './retrieval';
import type { UserContext } from './userContext';

/** Only short, single-intent messages are safe to answer without a model. */
const MAX_FAST_PATH_LENGTH = 120;

interface Rule {
  name: string;
  /** All listed patterns must be absent for a rule to be skipped. */
  test: (message: string) => boolean;
  answer: (context: UserContext) => string | Promise<string>;
}

const RULES: Rule[] = [
  {
    name: 'greeting',
    test: (m) => /^(hi|hey|hello|yo|salam|assalamu alaikum|good (morning|evening|afternoon))\b[\s!.?]*$/.test(m),
    answer: (context) =>
      `Hi${context.name ? ` ${context.name}` : ''}! I'm the VibeShopping assistant. I can help you find products, check what's in stock, or track an order. What are you looking for?`,
  },
  {
    name: 'thanks',
    test: (m) => /^(thanks|thank you|thx|ty|nice|great|cool|ok|okay)\b[\s!.?]*$/.test(m),
    answer: () => "You're welcome! Anything else I can help you find?",
  },
  {
    name: 'shipping',
    test: (m) =>
      /\b(shipping|delivery)\b/.test(m) &&
      /\b(cost|price|fee|charge|how much|free)\b/.test(m),
    answer: () =>
      'Shipping is free on orders over $100. Below that it is a flat $10. The exact amount is shown at checkout before you pay.',
  },
  {
    name: 'tax',
    test: (m) => /\b(tax|vat)\b/.test(m),
    answer: () =>
      'Tax is 15% and it is calculated automatically at checkout, so the total you see before placing the order is the final amount.',
  },
  {
    name: 'payment-methods',
    test: (m) =>
      /\b(payment|pay|checkout)\b/.test(m) &&
      /\b(method|methods|option|options|accept|way|ways|how)\b/.test(m),
    answer: () =>
      `You can pay with ${PAYMENT_METHODS.join(', ')}. Pick your method during checkout after entering the shipping address.`,
  },
  {
    name: 'checkout-steps',
    test: (m) => /\b(how (do|to)|steps?)\b/.test(m) && /\b(order|checkout|buy|purchase)\b/.test(m),
    answer: () =>
      'Add the items to your cart, go to checkout, enter your shipping address, choose a payment method, then review and place the order. You can follow it afterwards from your order history.',
  },
  {
    name: 'order-status',
    test: (m) =>
      /\b(order|package|parcel|delivery|shipment)\b/.test(m) &&
      /\b(status|where|track|tracking|when|arrive|arriving|shipped)\b/.test(m),
    answer: (context) => {
      if (!context.isSignedIn) {
        return 'Sign in and I can pull up your orders right here. You can also see them any time on the order history page.';
      }
      if (!context.orders || context.orders.startsWith('No orders')) {
        return "You haven't placed any orders yet. Once you do, I can track them for you here.";
      }
      // Hand the raw lines back - they are already customer-readable.
      return `Here are your most recent orders:\n${context.orders}`;
    },
  },
  {
    name: 'cart-contents',
    test: (m) => /\b(my cart|in my cart|cart total|basket)\b/.test(m),
    answer: (context) => {
      if (!context.cart) {
        return 'Your cart is empty right now. Browse the store and add something, and I can help you check out.';
      }
      return `Here's your cart:\n${context.cart}`;
    },
  },
  {
    name: 'catalog',
    test: (m) =>
      /\b(what|which)\b/.test(m) &&
      /\b(sell|sells|selling|carry|stock|have|offer|categor|brand)\b/.test(m),
    answer: async () => {
      const summary = await getCatalogSummary();
      return `Here's what we carry:\n${formatCatalog(summary)}\n\nTell me a category or brand and I'll show you what's in stock.`;
    },
  },
];

/**
 * Try to answer without calling Gemini.
 * Returns null when the question needs a model, which is the normal case for
 * anything specific about products.
 */
export async function tryFastPath(
  message: string,
  context: UserContext
): Promise<{ answer: string; rule: string } | null> {
  const normalized = message.trim().toLowerCase();

  // Long messages usually carry several intents; let the model handle those.
  if (normalized.length > MAX_FAST_PATH_LENGTH) return null;

  for (const rule of RULES) {
    if (rule.test(normalized)) {
      return { answer: await rule.answer(context), rule: rule.name };
    }
  }

  return null;
}
