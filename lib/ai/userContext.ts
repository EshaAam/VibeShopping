/**
 * Personal Context for the AI Assistant
 *
 * WHY: "Where is my order?" is the single most common support question, and it
 * is unanswerable from a static prompt. Because the chat runs inside a Server
 * Action we already have the session and cookies, so we can hand the model the
 * customer's own cart and orders.
 *
 * SECURITY: the user id always comes from the server-side session and the cart
 * id from an httpOnly cookie. The model never supplies an identifier, so it has
 * no way to ask about somebody else's data.
 */

import { auth } from '@/auth';
import { prisma } from '@/db/prisma';
import { cookies } from 'next/headers';
import { formatDateTime } from '@/lib/utils';

/** Shape of the entries stored in Cart.items / the cart JSON column. */
interface CartItemLike {
  name?: string;
  qty?: number;
  price?: string | number;
}

export interface UserContext {
  isSignedIn: boolean;
  name: string | null;
  cart: string | null;
  orders: string | null;
}

/** How many recent orders to describe. Enough for "my last order" questions. */
const RECENT_ORDER_LIMIT = 3;

async function getCartSummary(
  userId: string | undefined,
  sessionCartId: string | undefined
): Promise<string | null> {
  if (!userId && !sessionCartId) return null;

  const cart = await prisma.cart.findFirst({
    where: userId ? { userId } : { sessionCartId: sessionCartId! },
    select: { items: true, itemsPrice: true, totalPrice: true },
  });

  if (!cart) return null;

  const items = (cart.items as CartItemLike[]) ?? [];
  if (items.length === 0) return 'Cart is empty.';

  const lines = items.map(
    (item) => `- ${item.name ?? 'Unknown item'} x${item.qty ?? 1} @ $${Number(item.price ?? 0).toFixed(2)}`
  );

  const itemsPrice = Number(cart.itemsPrice);
  // Mirrors calcPrice() in cart.actions: free shipping above $100.
  const freeShippingNote =
    itemsPrice >= 100
      ? 'This cart qualifies for free shipping.'
      : `$${(100 - itemsPrice).toFixed(2)} more to qualify for free shipping.`;

  return [
    ...lines,
    `Subtotal: $${itemsPrice.toFixed(2)} | Order total with tax and shipping: $${Number(cart.totalPrice).toFixed(2)}`,
    freeShippingNote,
  ].join('\n');
}

async function getOrderSummary(userId: string): Promise<string | null> {
  const orders = await prisma.order.findMany({
    where: { userId },
    select: {
      id: true,
      createdAt: true,
      totalPrice: true,
      isPaid: true,
      isDelivered: true,
      orderStatus: true,
      trackingNumber: true,
    },
    orderBy: { createdAt: 'desc' },
    take: RECENT_ORDER_LIMIT,
  });

  if (orders.length === 0) return 'No orders placed yet.';

  return orders
    .map((order) => {
      const placed = formatDateTime(order.createdAt).dateOnly;
      const payment = order.isPaid ? 'paid' : 'not paid yet';
      const delivery = order.isDelivered ? 'delivered' : 'not delivered yet';
      const tracking = order.trackingNumber
        ? ` | tracking ${order.trackingNumber}`
        : '';

      // Full id included so the model can link to /order/<id>.
      return `- Order ${order.id} placed ${placed} | status ${order.orderStatus} | ${payment} | ${delivery} | $${Number(order.totalPrice).toFixed(2)}${tracking}`;
    })
    .join('\n');
}

/**
 * Gather everything we know about the current visitor.
 * Failures are swallowed: personal context is an enhancement, and the assistant
 * must still answer if the cart or order lookup breaks.
 */
export async function getUserContext(): Promise<UserContext> {
  try {
    const session = await auth();
    const userId = session?.user?.id as string | undefined;
    const sessionCartId = (await cookies()).get('sessionCartId')?.value;

    const [cart, orders] = await Promise.all([
      getCartSummary(userId, sessionCartId),
      userId ? getOrderSummary(userId) : Promise.resolve(null),
    ]);

    return {
      isSignedIn: Boolean(userId),
      name: session?.user?.name ?? null,
      cart,
      orders,
    };
  } catch (error) {
    console.error('[chat] failed to load user context:', error);
    return { isSignedIn: false, name: null, cart: null, orders: null };
  }
}

/**
 * Does this question depend on who is asking?
 *
 * WHY it matters twice over: personal questions need the cart/order lookup, and
 * they must never be served from the shared response cache - one customer's
 * order status must not leak to the next visitor who phrases it the same way.
 */
export function isPersonalQuestion(message: string): boolean {
  return /\b(my|mine|i|i'm|im|me)\b/i.test(message) ||
    /\b(order|orders|cart|checkout|wishlist|account|delivery|tracking|refund)\b/i.test(
      message
    );
}

/** Render the context block, omitting sections we have nothing for. */
export function formatUserContext(context: UserContext): string {
  const sections: string[] = [];

  sections.push(
    context.isSignedIn
      ? `The customer is signed in${context.name ? ` as ${context.name}` : ''}.`
      : 'The customer is NOT signed in. For order history they need to sign in first.'
  );

  if (context.cart) {
    sections.push(`Their cart right now:\n${context.cart}`);
  }

  if (context.orders) {
    sections.push(`Their recent orders:\n${context.orders}`);
  }

  return sections.join('\n\n');
}
