-- Optimistic concurrency for carts and wishlists: every save is conditional
-- on the version that was read, and bumps it.
ALTER TABLE "Cart" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Wishlist" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- One-off repair of wishlist items that were stored as strings: JSON strings
-- become objects again, "[object Object]" and anything without a productId
-- is dropped. Order is preserved.
CREATE FUNCTION pg_temp.try_jsonb(t text) RETURNS jsonb
LANGUAGE plpgsql AS $$
BEGIN
  RETURN t::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- "items" is JSONB[] when built from migrations but JSON[] per the schema, so
-- work in jsonb and cast back to whatever the live column actually is.
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT format_type(atttypid, atttypmod) INTO col_type
  FROM pg_attribute
  WHERE attrelid = '"Wishlist"'::regclass AND attname = 'items';

  EXECUTE format($sql$
    UPDATE "Wishlist" w
    SET items = COALESCE((
      SELECT array_agg(fixed::%1$s ORDER BY ord)
      FROM (
        SELECT ord,
               CASE WHEN jsonb_typeof(e::jsonb) = 'string'
                    THEN pg_temp.try_jsonb(e::jsonb #>> '{}')
                    ELSE e::jsonb END AS fixed
        FROM unnest(w.items) WITH ORDINALITY AS u(e, ord)
      ) cleaned
      WHERE jsonb_typeof(fixed) = 'object' AND fixed ->> 'productId' IS NOT NULL
    ), ARRAY[]::%2$s)
    WHERE EXISTS (
      SELECT 1 FROM unnest(w.items) AS e
      WHERE jsonb_typeof(e::jsonb) <> 'object' OR e::jsonb ->> 'productId' IS NULL
    )
  $sql$, replace(col_type, '[]', ''), col_type);
END
$$;
