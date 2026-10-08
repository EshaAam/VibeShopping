'use server';

import { auth } from '@/auth';
import { prisma } from '@/db/prisma';
import { WishlistItem } from '@/types';
import { cookies } from 'next/headers';
import { formatError } from '../utils';
import { wishlistItemSchema } from '../validator';
import { revalidatePath } from 'next/cache';
import { getMyWishlist } from '@/lib/data/wishlist';

const MAX_WISHLIST_RETRIES = 3;

// Same optimistic-concurrency save as the cart: only write if the version we
// read is still current, otherwise re-read and re-apply.
async function updateWishlistItems(
  change: (items: WishlistItem[]) => WishlistItem[]
) {
  for (let attempt = 0; attempt < MAX_WISHLIST_RETRIES; attempt++) {
    const wishlist = await getMyWishlist();
    if (!wishlist) throw new Error('Wishlist not found');

    const items = change(structuredClone(wishlist.items));

    const saved = await prisma.wishlist.updateMany({
      where: { id: wishlist.id, version: wishlist.version },
      data: { items, version: { increment: 1 } },
    });
    if (saved.count === 1) return items;
  }

  throw new Error('Your wishlist was changed elsewhere, please try again');
}

// Add item to wishlist
export async function addItemToWishlist(data: WishlistItem) {
  try {
    const sessionWishlistId = (await cookies()).get('sessionWishlistId')?.value;
    if (!sessionWishlistId) throw new Error('Wishlist Session not found');

    const session = await auth();
    const userId = session?.user?.id;

    const item = wishlistItemSchema.parse(data);

    const product = await prisma.product.findFirst({
      where: { id: item.productId },
    });
    if (!product) throw new Error('Product not found');
    if (product.archivedAt) throw new Error('This product is no longer available');

    // Store a plain object built from the database row - never the client's
    // copy, and never a string, which is how the old "[object Object]" rows
    // got in.
    const plainItem: WishlistItem = {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image: product.images[0],
    };

    if (!(await getMyWishlist())) {
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
    }

    let alreadyThere = false;
    await updateWishlistItems((items) => {
      alreadyThere = items.some((x) => x.productId === plainItem.productId);
      return alreadyThere ? items : [...items, plainItem];
    });

    if (alreadyThere) {
      return { success: false, message: 'Item already in wishlist' };
    }

    revalidatePath(`/product/${product.slug}`);
    revalidatePath('/wishlist');
    return {
      success: true,
      message: `${product.name} added to wishlist successfully`,
    };
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

    await updateWishlistItems((items) => {
      if (!items.some((x) => x.productId === productId)) {
        throw new Error('Item not found');
      }
      return items.filter((x) => x.productId !== productId);
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
