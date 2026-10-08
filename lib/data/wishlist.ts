import 'server-only';

import { auth } from '@/auth';
import { prisma } from '@/db/prisma';
import { WishlistItem } from '@/types';
import { cookies } from 'next/headers';

// Read-only queries for server components. These are deliberately NOT server
// actions: a 'use server' export is a public POST endpoint, and reads have no
// reason to be one. `server-only` makes importing this from a client
// component a build error.

// Get user's wishlist
export async function getMyWishlist() {
  try {
    const sessionWishlistId = (await cookies()).get('sessionWishlistId')?.value;
    if (!sessionWishlistId) return undefined;

    const session = await auth();
    const userId = session?.user?.id;

    const wishlist = await prisma.wishlist.findFirst({
      where: userId ? { userId } : { sessionWishlistId },
    });

    if (!wishlist) return undefined;

    // Safely parse items - handle corrupted data
    const items: WishlistItem[] = [];

    // The items field is Prisma.JsonValue[] which implies it could be any JSON type.
    // However, we expect it to be an array of objects or strings that can be parsed into objects.
    if (Array.isArray(wishlist.items)) {
      for (const item of wishlist.items) {
        if (!item) continue;

        if (typeof item === 'string') {
          // Check for known corruption patterns
          if (item === '[object Object]' || item.includes('[object Object]')) continue;
          
          try {
            const parsed = JSON.parse(item);
            if (parsed && typeof parsed === 'object' && 'productId' in parsed) {
              items.push(parsed as WishlistItem);
            }
          } catch {
             // Failed to parse, ignore this item
            continue;
          }
        } else if (typeof item === 'object' && 'productId' in item) {
          items.push(item as WishlistItem);
        }
      }
    }

    return {
      id: wishlist.id,
      userId: wishlist.userId,
      sessionWishlistId: wishlist.sessionWishlistId,
      items,
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

    // Safely parse items
    const items: WishlistItem[] = [];

    if (Array.isArray(wishlist.items)) {
      for (const item of wishlist.items) {
        if (!item) continue;

        if (typeof item === 'string') {
          if (item === '[object Object]' || item.includes('[object Object]')) continue;
          
          try {
            const parsed = JSON.parse(item);
            if (parsed && typeof parsed === 'object' && 'productId' in parsed) {
              items.push(parsed as WishlistItem);
            }
          } catch {
            continue;
          }
        } else if (typeof item === 'object' && 'productId' in item) {
          items.push(item as WishlistItem);
        }
      }
    }

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
