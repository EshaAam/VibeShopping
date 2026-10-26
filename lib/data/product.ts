import 'server-only';

import { prisma } from '@/db/prisma';
import { Prisma } from '@prisma/client';
import { LATEST_PRODUCTS_LIMIT, PAGE_SIZE } from '@/lib/constants';
import { convertToPlainObject, parsePage, parsePriceRange } from '@/lib/utils';

// Read-only queries for server components. These are deliberately NOT server
// actions: a 'use server' export is a public POST endpoint, and reads have no
// reason to be one. `server-only` makes importing this from a client
// component a build error.

//get the latest products
export async function getLatestProducts() {
//   const prisma = new PrismaClient();

  const data = await prisma.product.findMany({
    where: { archivedAt: null },
    take: LATEST_PRODUCTS_LIMIT,
    orderBy: { createdAt: 'desc' },
  });

  return convertToPlainObject(data);
}

//get a product by the slug
export async function getProductBySlug(slug: string) {
  return  await prisma.product.findUnique({
    where: { slug: slug },
  });
}

// Get single product by id
export async function getProductById(productId: string) {
  const data = await prisma.product.findFirst({
    where: { id: productId },
  });

  return convertToPlainObject(data);
}

// Get price range (min and max prices)
export async function getPriceRange() {
  const result = await prisma.product.aggregate({
    where: { archivedAt: null },
    _min: { price: true },
    _max: { price: true },
  });

  return {
    minPrice: Math.floor(Number(result._min.price) || 0),
    maxPrice: Math.ceil(Number(result._max.price) || 1000000),
  };
}

// Get all products
export async function getAllProducts({
  query,
  limit = PAGE_SIZE,
  page,
  category,
  price,
  rating,
  sort,
  includeArchived = false,
}: {
  query: string;
  category: string;
  limit?: number;
  page: number;
  price?: string;
  rating?: string;
  sort?: string;
  /** Admin listings show archived products; the storefront never does. */
  includeArchived?: boolean;
}) {
  const archivedFilter: Prisma.ProductWhereInput = includeArchived
    ? {}
    : { archivedAt: null };

  const queryFilter: Prisma.ProductWhereInput =
    query && query !== 'all'
      ? {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        }
      : {};

  const categoryFilter =
    category && category !== 'all' ? { category } : {};

  const minRating = Number(rating);
  const ratingFilter =
    rating && rating !== 'all' && Number.isFinite(minRating)
      ? {
          rating: {
            gte: minRating,
          },
        }
      : {};

  const priceRange = parsePriceRange(price);
  const priceFilter = priceRange
    ? { price: { gte: priceRange.min, lte: priceRange.max } }
    : {};
  const currentPage = parsePage(page);

  const data = await prisma.product.findMany({
    where: {
      ...queryFilter,
      ...categoryFilter,
      ...ratingFilter,
      ...priceFilter,
      ...archivedFilter,
    },
    orderBy:
      sort === 'lowest'
        ? { price: 'asc' }
        : sort === 'highest'
        ? { price: 'desc' }
        : sort === 'rating'
        ? { rating: 'desc' }
        : { createdAt: 'desc' },
    skip: (currentPage - 1) * limit,
    take: limit,
  });

  const dataCount = await prisma.product.count({
    where: {
      ...queryFilter,
      ...categoryFilter,
      ...ratingFilter,
      ...priceFilter,
      ...archivedFilter,
    },
  });

  return {
    data,
    totalPages: Math.ceil(dataCount / limit),
  };
}

// Get product categories
export async function getAllCategories() {
  const data = await prisma.product.groupBy({
    by: ['category'],
    where: { archivedAt: null },
    _count: true,
  });

  return data.map((item) => ({
    category: item.category,
    _count: item._count,
  }));
}

// Get featured products
export async function getFeaturedProducts() {
  const data = await prisma.product.findMany({
    where: { isFeatured: true, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 4,
  });

  return convertToPlainObject(data);
}
