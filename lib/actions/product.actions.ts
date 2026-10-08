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
    if (productExists.archivedAt) throw new Error('Product is already archived');

    // Once sold, a product is archived rather than deleted: past orders,
    // invoices and reviews still point at it, but the store hides it.
    const soldBefore = await prisma.orderItem.findFirst({
      where: { productId: id },
    });
    if (soldBefore) {
      await prisma.product.update({
        where: { id },
        data: { archivedAt: new Date(), isFeatured: false },
      });
      revalidatePath('/admin/products');
      return {
        success: true,
        message: 'Product archived. It is hidden from the store but kept for past orders.',
      };
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
      archivedAt: null,
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