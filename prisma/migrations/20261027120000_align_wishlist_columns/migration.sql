-- Bring "Wishlist" in line with schema.prisma. Built from migrations, these
-- columns were JSONB[] and TIMESTAMP(6); the live database got them from
-- `db push` as JSON[] and TIMESTAMP(3), which is what the schema says. Where
-- they already match, these statements change nothing.
ALTER TABLE "Wishlist" ALTER COLUMN "items" DROP DEFAULT;
ALTER TABLE "Wishlist" ALTER COLUMN "items" SET DATA TYPE JSON[] USING "items"::JSON[];
ALTER TABLE "Wishlist" ALTER COLUMN "items" SET DEFAULT ARRAY[]::JSON[];
ALTER TABLE "Wishlist" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);
