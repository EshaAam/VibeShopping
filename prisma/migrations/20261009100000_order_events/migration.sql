-- Order status becomes a Postgres enum, and every order gets an append-only
-- event history that the flags on "Order" are projected from.
--
-- Hand-written: Prisma's generated diff drops and re-adds "orderStatus",
-- which would reset every existing order to Pending.

-- "orderStatus" and "trackingNumber" were added to live databases outside the
-- migration history (db push). Create them where missing so this migration
-- works on both a live database and one built from migrations alone.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderStatus" TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('Created', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled');

-- Convert the status column in place, keeping every order's current value
UPDATE "Order" SET "orderStatus" = 'Pending'
WHERE "orderStatus" IS NULL
   OR "orderStatus" NOT IN ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled');
ALTER TABLE "Order" ALTER COLUMN "orderStatus" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "orderStatus" TYPE "OrderStatus" USING "orderStatus"::"OrderStatus";
ALTER TABLE "Order" ALTER COLUMN "orderStatus" SET DEFAULT 'Pending';
ALTER TABLE "Order" ALTER COLUMN "orderStatus" SET NOT NULL;

-- Make the flags agree with each other, then have the database keep them that
-- way. Status is the source of truth for delivery.
UPDATE "Order" SET "paidAt" = "createdAt" WHERE "isPaid" AND "paidAt" IS NULL;
UPDATE "Order" SET "paidAt" = NULL WHERE NOT "isPaid" AND "paidAt" IS NOT NULL;
UPDATE "Order" SET "isDelivered" = true, "deliveredAt" = COALESCE("deliveredAt", "createdAt")
WHERE "orderStatus" = 'Delivered';
UPDATE "Order" SET "isDelivered" = false, "deliveredAt" = NULL
WHERE "orderStatus" <> 'Delivered';

ALTER TABLE "Order" ADD CONSTRAINT "order_paid_consistent"
  CHECK ("isPaid" = ("paidAt" IS NOT NULL));
ALTER TABLE "Order" ADD CONSTRAINT "order_delivered_consistent"
  CHECK ("isDelivered" = ("orderStatus" = 'Delivered') AND "isDelivered" = ("deliveredAt" IS NOT NULL));

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "actorId" UUID,
    "data" JSON,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "orderEvent_orderId_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Backfill a best-effort history for existing orders. Exact times for
-- intermediate steps were never recorded, so those rows are flagged.
INSERT INTO "OrderEvent" ("orderId", "type", "createdAt", "data")
SELECT "id", 'Created', "createdAt", '{"backfilled":true}' FROM "Order";

INSERT INTO "OrderEvent" ("orderId", "type", "createdAt", "data")
SELECT "id", 'Paid', "paidAt", '{"backfilled":true}' FROM "Order" WHERE "isPaid";

INSERT INTO "OrderEvent" ("orderId", "type", "createdAt", "data")
SELECT "id",
       "orderStatus"::text::"OrderEventType",
       COALESCE("deliveredAt", "paidAt", "createdAt"),
       json_build_object('backfilled', true, 'trackingNumber', "trackingNumber")
FROM "Order" WHERE "orderStatus" <> 'Pending';

-- Append-only: history can be added to, never rewritten or erased
CREATE FUNCTION "order_event_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'OrderEvent rows are append-only';
END;
$$;

CREATE TRIGGER "order_event_append_only"
BEFORE UPDATE OR DELETE ON "OrderEvent"
FOR EACH ROW EXECUTE FUNCTION "order_event_append_only"();
