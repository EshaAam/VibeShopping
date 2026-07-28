/**
 * Product Retrieval for the AI Assistant
 *
 * WHY: Gemini has no idea what is in your database. Rather than fine-tuning or
 * embedding anything, we run one Prisma query per question and paste the rows
 * into the prompt. The model becomes stock-aware without a single extra API
 * call - the live data comes from Postgres, Gemini only phrases it.
 *
 * WHY keyword matching instead of embeddings: the catalog is small and an
 * ILIKE scan costs nothing. Vector search would mean an extra embedding request
 * per message, which is exactly the free-tier budget we are trying to protect.
 */

import { prisma } from '@/db/prisma';

/** Words that match everything and therefore match nothing useful. */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'you', 'have', 'has', 'can', 'get', 'got',
  'any', 'all', 'this', 'that', 'with', 'what', 'which', 'want', 'need',
  'show', 'find', 'looking', 'look', 'give', 'tell', 'about', 'there',
  'your', 'from', 'some', 'stock', 'available', 'buy', 'price', 'cost',
  'product', 'products', 'item', 'items', 'much', 'many', 'does', 'did',
  'please', 'would', 'could', 'should', 'like', 'know', 'sell', 'selling',
  // Filter words - already captured structurally by parseQuery, and as search
  // terms they match nothing ("something under $100" must not search "something").
  'something', 'anything', 'under', 'over', 'below', 'above', 'than', 'less',
  'more', 'cheap', 'cheaper', 'cheapest', 'best', 'good', 'between', 'around',
]);

/** Max products injected into a prompt - more rows just burn tokens. */
const MAX_PRODUCTS = 8;

export interface RetrievedProduct {
  name: string;
  slug: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  numReviews: number;
}

interface ParsedQuery {
  terms: string[];
  maxPrice: number | null;
  minPrice: number | null;
  inStockOnly: boolean;
}

/**
 * Pull structured filters out of natural language.
 * Deliberately simple - the model handles nuance, this only needs to catch the
 * common shapes ("under $50", "in stock", "cheap shoes").
 */
export function parseQuery(message: string): ParsedQuery {
  const lower = message.toLowerCase();

  const under = lower.match(/(?:under|below|less than|cheaper than|max)\s*\$?\s*(\d+(?:\.\d+)?)/);
  const over = lower.match(/(?:over|above|more than|at least|min)\s*\$?\s*(\d+(?:\.\d+)?)/);

  const inStockOnly =
    /\bin stock\b|\bavailable\b|\bavailability\b|\bleft\b|\bsold out\b|\bout of stock\b/.test(
      lower
    );

  const terms = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, 6);

  return {
    terms,
    maxPrice: under ? Number(under[1]) : null,
    minPrice: over ? Number(over[1]) : null,
    inStockOnly,
  };
}

/**
 * Expand a term to the forms worth matching.
 *
 * WHY: customers type plurals ("laptops", "shoes") while the catalog stores
 * singulars ("Laptop"), and a substring match on the plural never hits. Adding
 * the de-pluralised forms as extra OR clauses is cheap and costs no recall,
 * since a false variant simply matches nothing.
 */
function expandTerm(term: string): string[] {
  const variants = new Set([term]);

  if (term.endsWith('ies') && term.length > 4) {
    variants.add(`${term.slice(0, -3)}y`);
  }
  if (term.endsWith('es') && term.length > 4) {
    variants.add(term.slice(0, -2));
  }
  if (term.endsWith('s') && term.length > 3) {
    variants.add(term.slice(0, -1));
  }

  return [...variants];
}

/**
 * Find products relevant to a customer message.
 * Returns an empty array when the message has no product-ish terms, which the
 * prompt treats as "no matches" so the model won't invent any.
 */
export async function retrieveProducts(
  message: string
): Promise<RetrievedProduct[]> {
  const { terms, maxPrice, minPrice, inStockOnly } = parseQuery(message);

  // No usable terms and no price filter - nothing to search on.
  if (terms.length === 0 && maxPrice === null && minPrice === null) {
    return [];
  }

  const textFilter =
    terms.length > 0
      ? {
          OR: terms
            .flatMap(expandTerm)
            .flatMap((term) => [
              { name: { contains: term, mode: 'insensitive' as const } },
              { brand: { contains: term, mode: 'insensitive' as const } },
              { category: { contains: term, mode: 'insensitive' as const } },
            ]),
        }
      : {};

  const priceFilter: { gte?: number; lte?: number } = {};
  if (minPrice !== null) priceFilter.gte = minPrice;
  if (maxPrice !== null) priceFilter.lte = maxPrice;

  const hasPriceFilter = Object.keys(priceFilter).length > 0;

  const rows = await search({
    ...textFilter,
    ...(hasPriceFilter ? { price: priceFilter } : {}),
    ...(inStockOnly ? { stock: { gt: 0 } } : {}),
  });

  // "show me something under $100" leaves no meaningful search terms, so the
  // text filter can only shrink a perfectly good price-based result set.
  // Retry on price alone before giving up.
  if (rows.length === 0 && hasPriceFilter && terms.length > 0) {
    const priceOnly = await search({
      price: priceFilter,
      ...(inStockOnly ? { stock: { gt: 0 } } : {}),
    });
    return priceOnly.map(toRetrievedProduct);
  }

  return rows.map(toRetrievedProduct);
}

/** Shared query body so the primary search and the price-only retry stay in sync. */
async function search(where: Record<string, unknown>) {
  return prisma.product.findMany({
    where,
    select: {
      name: true,
      slug: true,
      brand: true,
      category: true,
      price: true,
      stock: true,
      rating: true,
      numReviews: true,
    },
    // In-stock and well-rated items first so the truncated list is the useful one.
    orderBy: [{ stock: 'desc' }, { rating: 'desc' }],
    take: MAX_PRODUCTS,
  });
}

/** price/rating arrive as strings via the Prisma result extension in db/prisma. */
function toRetrievedProduct(
  row: Awaited<ReturnType<typeof search>>[number]
): RetrievedProduct {
  return {
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    price: Number(row.price),
    stock: row.stock,
    rating: Number(row.rating),
    numReviews: row.numReviews,
  };
}

/**
 * Render products as compact lines.
 * WHY not JSON: plain lines cost roughly half the tokens and models follow them
 * just as reliably.
 */
export function formatProducts(products: RetrievedProduct[]): string {
  if (products.length === 0) {
    return 'No products in the catalog match this question.';
  }

  return products
    .map((product) => {
      const availability =
        product.stock === 0
          ? 'OUT OF STOCK'
          : product.stock < 5
            ? `only ${product.stock} left`
            : `${product.stock} in stock`;

      const reviews =
        product.numReviews > 0
          ? `${product.rating.toFixed(1)}/5 from ${product.numReviews} reviews`
          : 'no reviews yet';

      return `- ${product.name} | ${product.brand} | ${product.category} | $${product.price.toFixed(2)} | ${availability} | ${reviews} | /product/${product.slug}`;
    })
    .join('\n');
}

interface CatalogSummary {
  categories: string[];
  brands: string[];
  totalProducts: number;
  inStockCount: number;
}

/** Cached catalog shape - it changes rarely and every request would otherwise re-scan. */
let catalogCache: { data: CatalogSummary; expiresAt: number } | null = null;
const CATALOG_TTL_MS = 10 * 60 * 1000;

/**
 * A high-level view of the store, used for "what do you sell" style questions
 * where no specific product matched.
 */
export async function getCatalogSummary(): Promise<CatalogSummary> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.data;
  }

  const [categories, brands, totalProducts, inStockCount] = await Promise.all([
    prisma.product.findMany({ distinct: ['category'], select: { category: true } }),
    prisma.product.findMany({ distinct: ['brand'], select: { brand: true } }),
    prisma.product.count(),
    prisma.product.count({ where: { stock: { gt: 0 } } }),
  ]);

  const data: CatalogSummary = {
    categories: categories.map((row) => row.category).sort(),
    brands: brands.map((row) => row.brand).sort(),
    totalProducts,
    inStockCount,
  };

  catalogCache = { data, expiresAt: Date.now() + CATALOG_TTL_MS };
  return data;
}

export function formatCatalog(summary: CatalogSummary): string {
  return [
    `Categories: ${summary.categories.join(', ') || 'none yet'}`,
    `Brands: ${summary.brands.join(', ') || 'none yet'}`,
    `${summary.totalProducts} products total, ${summary.inStockCount} currently in stock`,
  ].join('\n');
}
