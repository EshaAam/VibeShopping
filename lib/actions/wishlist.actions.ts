'use server';

import { auth } from '@/auth';
import { prisma } from '@/db/prisma';
import { WishlistItem } from '@/types';
import { cookies } from 'next/headers';
import { formatError } from '../utils';
import { wishlistItemSchema } from '../validator';
import { revalidatePath } from 'next/cache';
import { getMyWishlist } from '@/lib/data/wishlist';

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
    if (product.archivedAt) throw new Error('This product is no longer available');

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
