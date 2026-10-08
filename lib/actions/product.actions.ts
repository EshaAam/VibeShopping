'use server';

import { convertToPlainObject, formatError } from "../utils";
import { prisma } from "@/db/prisma";
import { revalidatePath } from "next/cache";
import { insertProductSchema, updateProductSchema } from '../validator';
import { z } from 'zod';
import { requireAdmin } from '../auth-guard';

// Delete Product
export async function deleteProduct(id: string) {
  try {
    await requireAdmin();

    const productExists = await prisma.product.findFirst({
      where: { id },
    });

    if (!productExists) throw new Error('Product not found');

    // Order history references products, so a sold product can't be deleted.
    const soldBefore = await prisma.orderItem.findFirst({
      where: { productId: id },
    });
    if (soldBefore) {
      throw new Error(
        'This product appears in past orders and cannot be deleted. Set its stock to 0 to stop selling it.'
      );
    }

    await prisma.product.delete({ where: { id } });

    revalidatePath('/admin/products');

    return {
      success: true,
      message: 'Product deleted successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Create Product
export async function createProduct(data: z.infer<typeof insertProductSchema>) {
  try {
    await requireAdmin();

    // Validate and create product
    const product = insertProductSchema.parse(data);
    await prisma.product.create({ data: product });

    revalidatePath('/admin/products');

    return {
      success: true,
      message: 'Product created successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Update Product
export async function updateProduct(data: z.infer<typeof updateProductSchema>) {
  try {
    await requireAdmin();

    // Validate and find product
    const product = updateProductSchema.parse(data);
    const productExists = await prisma.product.findFirst({
      where: { id: product.id },
    });

    if (!productExists) throw new Error('Product not found');

    // Update product
    await prisma.product.update({ where: { id: product.id }, data: product });

    revalidatePath('/admin/products');

    return {
      success: true,
      message: 'Product updated successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Search suggestions - Amazon-style autocomplete
export async function getSearchSuggestions(query: string, category?: string) {
  if (!query || query.length < 1) {
    return [];
  }

  const categoryFilter = category && category !== 'all' ? { category } : {};

  // Get products matching the query
  const products = await prisma.product.findMany({
    where: {
      ...categoryFilter,
      OR: [
        {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          category: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          brand: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      brand: true,
      price: true,
      images: true,
    },
    orderBy: [
      { name: 'asc' }, // Lexicographical order
    ],
    take: 8, // Limit suggestions
  });

  return convertToPlainObject(products);
}