'use server';

import { auth } from '@/auth';
import { prisma } from '@/db/prisma';
import { WishlistItem } from '@/types';
import { cookies } from 'next/headers';
import { formatError } from '../utils';
import { wishlistItemSchema } from '../validator';
import { revalidatePath } from 'next/cache';

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

// Add item to wishlist
export async function addItemToWishlist(data: WishlistItem) {
  try {
    const sessionWishlistId = (await cookies()).get('sessionWishlistId')?.value;
    if (!sessionWishlistId) throw new Error('Wishlist Session not found');

    const session = await auth();
    const userId = session?.user?.id;

    const wishlist = await getMyWishlist();
    const item = wishlistItemSchema.parse(data);

    // Create a plain object with only the required fields
    const plainItem = {
      productId: item.productId,
      name: item.name,
      slug: item.slug,
      price: item.price,
      image: item.image,
    };

    const product = await prisma.product.findFirst({
      where: { id: item.productId },
    });
    if (!product) throw new Error('Product not found');

    if (!wishlist) {
      // Create new wishlist
      await prisma.wishlist.create({
        data: {
          userId: userId ?? null,
          sessionWishlistId,
          items: [plainItem],
        },
      });

      revalidatePath(`/product/${product.slug}`);
      revalidatePath('/wishlist');
      return {
        success: true,
        message: 'Item added to wishlist successfully',
      };
    } else {
      // Check if item already exists
      const existItem = wishlist.items.find(
        (x) => x.productId === item.productId
      );

      if (existItem) {
        return { success: false, message: 'Item already in wishlist' };
      }

      // Add item to existing wishlist
      const updatedItems = [...wishlist.items, plainItem];

      await prisma.wishlist.update({
        where: { id: wishlist.id },
        data: {
          items: updatedItems,
        },
      });

      revalidatePath(`/product/${product.slug}`);
      revalidatePath('/wishlist');
      return {
        success: true,
        message: `${product.name} added to wishlist successfully`,
      };
    }
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Remove item from wishlist
export async function removeItemFromWishlist(productId: string) {
  try {
    const sessionWishlistId = (await cookies()).get('sessionWishlistId')?.value;
    if (!sessionWishlistId) throw new Error('Wishlist Session not found');

    const product = await prisma.product.findFirst({
      where: { id: productId },
    });
    if (!product) throw new Error('Product not found');

    const wishlist = await getMyWishlist();
    if (!wishlist) throw new Error('Wishlist not found');

    const exist = wishlist.items.find((x) => x.productId === productId);
    if (!exist) throw new Error('Item not found');

    // Remove item from wishlist
    const updatedItems = wishlist.items.filter(
      (x) => x.productId !== productId
    );

    await prisma.wishlist.update({
      where: { id: wishlist.id },
      data: {
        items: updatedItems,
      },
    });

    revalidatePath(`/product/${product.slug}`);
    revalidatePath('/wishlist');
    return {
      success: true,
      message: `${product.name} removed from wishlist successfully`,
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}
