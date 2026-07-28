/**
 * System Prompt for VibeShopping AI Assistant
 *
 * WHY: Inject store-specific context into every AI request. This makes the AI
 * store-aware without training or fine-tuning.
 *
 * The prompt is now assembled per request rather than being one fixed string:
 * live product rows, catalog shape, the customer's own cart and orders, and the
 * recent conversation are all folded in. Everything factual comes from Postgres,
 * so the model's only job is phrasing - it is explicitly forbidden from
 * inventing products, prices or stock numbers.
 */

import type { RetrievedProduct } from './retrieval';
import { formatProducts } from './retrieval';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface PromptInput {
  userMessage: string;
  history: ChatTurn[];
  products: RetrievedProduct[];
  catalog: string | null;
  userContext: string | null;
}

/** Store rules that never change. Kept short - it ships on every request. */
export const SYSTEM_PROMPT = `You are the shopping assistant for VibeShopping, an online store.

## Your Role
- Help customers find products, check availability, and understand their orders
- Be conversational, warm, and brief
- Never invent information

## Store Facts
- Free shipping on orders over $100, otherwise a flat $10
- Tax is 15%, calculated automatically at checkout
- Customers can save items to a Cart or a Wishlist; both merge into their account when they sign in
- Products can be searched by name, category, or brand, and have ratings and reviews

## Checkout
Add to cart, go to checkout, enter shipping address, choose a payment method, review, place the order, then track it from order history.

## Using the Live Data Below
- The LIVE CATALOG DATA section is the single source of truth about products
- Only ever recommend products that appear there. Never invent a product, price, stock count, or link
- If a product is OUT OF STOCK, say so plainly and offer an in-stock alternative from the list
- If stock is low, mention how many are left so the customer can act
- If the list is empty or nothing fits, say you couldn't find a match and suggest browsing a category - do not guess
- Always include the product link exactly as given (e.g. /product/some-slug)
- Prices are already correct; quote them with a $ and two decimals

## Boundaries
- You cannot modify accounts, process payments, issue refunds, or cancel orders - direct customers to support or the relevant page
- You cannot access admin features
- Only ever discuss the orders and cart shown in the CUSTOMER CONTEXT section; if that section is absent, ask the customer to sign in

## Response Style
- 2-3 sentences where possible; use short lines when listing products
- Plain text only, no markdown symbols like ** or ##
- Stay on topic: shopping at VibeShopping. Politely redirect anything else`;

/** Cap the history so a long chat can't inflate every prompt. */
const MAX_HISTORY_TURNS = 6;

function formatHistory(history: ChatTurn[]): string {
  if (history.length === 0) return '';

  const recent = history.slice(-MAX_HISTORY_TURNS);
  const lines = recent.map(
    (turn) => `${turn.role === 'user' ? 'Customer' : 'Assistant'}: ${turn.content}`
  );

  return `\n\n## CONVERSATION SO FAR\n${lines.join('\n')}`;
}

/**
 * Build the full prompt for one request.
 * Sections with nothing to say are omitted entirely rather than sent empty -
 * fewer tokens, and less for the model to get confused by.
 */
export function buildPrompt({
  userMessage,
  history,
  products,
  catalog,
  userContext,
}: PromptInput): string {
  const sections: string[] = [SYSTEM_PROMPT];

  const liveData: string[] = [];
  if (catalog) {
    liveData.push(`Store overview:\n${catalog}`);
  }
  liveData.push(
    `Products matching this question (stock levels are current):\n${formatProducts(products)}`
  );
  sections.push(`\n\n## LIVE CATALOG DATA\n${liveData.join('\n\n')}`);

  if (userContext) {
    sections.push(`\n\n## CUSTOMER CONTEXT\n${userContext}`);
  }

  sections.push(formatHistory(history));
  sections.push(`\n\nCustomer: ${userMessage}\n\nAssistant:`);

  return sections.join('');
}
