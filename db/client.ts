import { Prisma, PrismaClient } from '@prisma/client';

// Builds the app's Prisma client on any driver adapter. Production uses Neon
// (db/prisma.ts); tests build the same client on plain Postgres, so they see
// exactly the shapes the app sees - including the string prices below.
export function createPrisma(adapter: NonNullable<Prisma.PrismaClientOptions['adapter']>) {
  // Extends the PrismaClient with a custom result transformer to convert the price and rating fields to strings.
  return new PrismaClient({ adapter }).$extends({
    result: {
      product: {
        price: {
          compute(product) {
            return product.price ? product.price.toString() : '0';
          },
        },
        rating: {
          compute(product) {
            return product.rating ? product.rating.toString() : '0';
          },
        },
      },
    },
  });
}

export type AppPrismaClient = ReturnType<typeof createPrisma>;
