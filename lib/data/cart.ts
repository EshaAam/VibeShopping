import 'server-only';

import { auth } from '@/auth';
import { prisma } from '@/db/prisma';
import { CartItem } from '@/types';
import { cookies } from 'next/headers';
import { convertToPlainObject } from '@/lib/utils';

// Read-only queries for server components. These are deliberately NOT server
// actions: a 'use server' export is a public POST endpoint, and reads have no
// reason to be one. `server-only` makes importing this from a client
// component a build error.

export async function getMyCart() {
  // Check for session cart cookie
  const sessionCartId = (await cookies()).get("sessionCartId")?.value;
  if (!sessionCartId) return undefined;

  // Get session and user ID
  const session = await auth();
  const userId = session?.user?.id ? (session.user.id as string) : undefined;

  // Get user cart from database
  const cart = await prisma.cart.findFirst({
    where: userId ? { userId: userId } : { sessionCartId: sessionCartId },
  });

  if (!cart) return undefined;

  // Convert Decimal values to strings
  return convertToPlainObject({
    ...cart,
    items: cart.items as CartItem[],
    itemsPrice: cart.itemsPrice.toString(),
    totalPrice: cart.totalPrice.toString(),
    shippingPrice: cart.shippingPrice.toString(),
    taxPrice: cart.taxPrice.toString(),
  });
}

// Get shared cart by ID (public access)
export async function getSharedCart(cartId: string) {
  try {
    const cart = await prisma.cart.findFirst({
      where: { id: cartId },
      include: {
        user: { select: { name: true } },
      },
    });

    if (!cart) return undefined;

    return {
      ...convertToPlainObject(cart),
      userName: cart.user?.name || 'Someone',
    };
  } catch {
    return undefined;
  }
}
