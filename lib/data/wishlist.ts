import 'server-only';

import { auth } from '@/auth';
import { prisma } from '@/db/prisma';
import { WishlistItem } from '@/types';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Read-only queries for server components. These are deliberately NOT server
// actions: a 'use server' export is a public POST endpoint, and reads have no
// reason to be one. `server-only` makes importing this from a client
// component a build error.

// Items are stored as JSON, so check their shape on the way out rather than
// trusting the column. Anything malformed is dropped instead of crashing the
// page; the migration that added Wishlist.version already cleaned up the old
// stringified rows.
const storedItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  slug: z.string(),
  image: z.string(),
  price: z.union([z.string(), z.number()]).transform(String),
});

function parseWishlistItems(raw: unknown[]): WishlistItem[] {
  return raw.flatMap((item) => {
    const parsed = storedItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

// Get user's wishlist
export async function getMyWishlist() {
  try {
    const sessionWishlistId = (await cookies()).get('sessionWishlistId')?.value;
    if (!sessionWishlistId) return undefined;

    const session = await auth();
    const userId = session?.user?.id;

    const wishlist = await prisma.wishlist.findFirst({
      // Guests only get an unclaimed wishlist - same reason as getMyCart
      where: userId ? { userId } : { sessionWishlistId, userId: null },
    });

    if (!wishlist) return undefined;

    const items = parseWishlistItems(wishlist.items);

    return {
      id: wishlist.id,
      userId: wishlist.userId,
      sessionWishlistId: wishlist.sessionWishlistId,
      items,
      version: wishlist.version,
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
    };
  } catch (error) {
    console.error('Error in getMyWishlist:', error);
    return undefined;
  }
}

// Get shared wishlist by ID (public access)
export async function getSharedWishlist(wishlistId: string) {
  try {
    const wishlist = await prisma.wishlist.findFirst({
      where: { id: wishlistId },
      include: {
        user: { select: { name: true } },
      },
    });

    if (!wishlist) return undefined;

    const items = parseWishlistItems(wishlist.items);

    return {
      id: wishlist.id,
      userId: wishlist.userId,
      items,
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
      userName: wishlist.user?.name || 'Someone',
    };
  } catch {
    return undefined;
  }
}
