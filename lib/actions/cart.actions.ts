"use server";

import { auth } from "@/auth";
import { prisma } from "@/db/prisma";
import { CartItem } from "@/types";
import { cookies } from "next/headers";
import { calcPrice, formatError } from "../utils";
import { getMyCart } from "@/lib/data/cart";
import { cartItemSchema, insertCartSchema } from "../validator";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

const MAX_CART_RETRIES = 3;

// Read the cart, apply `change` to its items, and save only if nobody else
// saved in between (optimistic concurrency on Cart.version). Two quick clicks
// both read version N; the first write moves it to N+1, so the second matches
// zero rows, re-reads, and applies its change on top instead of overwriting.
async function updateCartItems(change: (items: CartItem[]) => CartItem[]) {
  for (let attempt = 0; attempt < MAX_CART_RETRIES; attempt++) {
    const cart = await getMyCart();
    if (!cart) throw new Error("Cart not found");

    const items = change(structuredClone(cart.items as CartItem[]));

    const saved = await prisma.cart.updateMany({
      where: { id: cart.id, version: cart.version },
      data: {
        items: items as Prisma.InputJsonValue[],
        ...calcPrice(items),
        version: { increment: 1 },
      },
    });
    if (saved.count === 1) return items;
  }

  throw new Error("Your cart was changed elsewhere, please try again");
}

export async function addItemToCart(data: CartItem) {
  try {
    const sessionCartId = (await cookies()).get("sessionCartId")?.value;
    if (!sessionCartId) throw new Error("Cart Session not found");

    // Get session and user ID
    // Calls NextAuth to get the current user's session
    const session = await auth();
    const userId = session?.user?.id ? (session.user.id as string) : undefined;
    const { productId } = cartItemSchema.parse(data);
    // Find product in database
    const product = await prisma.product.findFirst({
      where: { id: productId },
    });
    if (!product) throw new Error("Product not found");
    if (product.archivedAt) throw new Error("This product is no longer available");

    // Only the product id comes from the client. Price, name and image are
    // taken from the database so a tampered request can't change what we charge.
    const item: CartItem = {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: product.images[0],
      price: product.price,
      qty: 1,
    };

    if (!(await getMyCart())) {
      if (product.stock < 1) throw new Error("Not enough stock");

      await prisma.cart.create({
        data: insertCartSchema.parse({
          userId: userId,
          items: [item],
          sessionCartId: sessionCartId,
          ...calcPrice([item]),
        }),
      });

      revalidatePath(`/product/${product.slug}`);
      return {
        success: true,
        message: "Item added to cart successfully",
      };
    }

    let existed = false;
    await updateCartItems((items) => {
      const existing = items.find((x) => x.productId === item.productId);
      existed = !!existing;

      if (existing) {
        if (product.stock < existing.qty + 1) throw new Error("Not enough stock");
        existing.qty += 1;
        return items;
      }

      if (product.stock < 1) throw new Error("Not enough stock");
      return [...items, item];
    });

    revalidatePath(`/product/${product.slug}`);
    return {
      success: true,
      message: `${product.name} ${
        existed ? "updated in" : "added to"
      } cart successfully`,
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Remove item from cart in database
export async function removeItemFromCart(productId: string) {
  try {
    // Get session cart id
    const sessionCartId = (await cookies()).get("sessionCartId")?.value;
    if (!sessionCartId) throw new Error("Cart Session not found");

    // Get product
    const product = await prisma.product.findFirst({
      where: { id: productId },
    });
    if (!product) throw new Error("Product not found");

    const items = await updateCartItems((current) => {
      const existing = current.find((x) => x.productId === productId);
      if (!existing) throw new Error("Item not found");

      // Last one goes, otherwise drop the quantity by one
      if (existing.qty === 1) {
        return current.filter((x) => x.productId !== productId);
      }
      existing.qty -= 1;
      return current;
    });

    // Revalidate product page
    revalidatePath(`/product/${product.slug}`);

    return {
      success: true,
      message: `${product.name} ${
        items.find((x) => x.productId === productId)
          ? "updated in"
          : "removed from"
      } cart successfully`,
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}
