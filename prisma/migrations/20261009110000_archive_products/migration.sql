-- Products that have been sold are archived instead of deleted, so order
-- history, invoices and reviews keep pointing at a real row.
ALTER TABLE "Product" ADD COLUMN "archivedAt" TIMESTAMP(6);

-- Orders are financial records: cancel them, never delete them.
CREATE FUNCTION "order_no_delete"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Orders cannot be deleted; cancel them instead';
END;
$$;

CREATE TRIGGER "order_no_delete"
BEFORE DELETE ON "Order"
FOR EACH ROW EXECUTE FUNCTION "order_no_delete"();
