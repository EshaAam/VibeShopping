/**
 * The migrations themselves. Production was not built from migrations alone:
 * "orderStatus" and "trackingNumber" were added with `db push`, statuses were
 * free text, flags disagreed, and old wishlist rows held "[object Object]".
 * DB-07 recreates that mess and checks the real migration files repair it;
 * DB-08 checks migrations and schema.prisma describe the same database.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, setupTestDatabase } from '../helpers/db';
import { applyMigrations } from '../setup/migrations';

const ORDER_EVENTS = '20261009100000_order_events';

const migrated = setupTestDatabase();

describe('DB-07: migrating a drifted production database', () => {
  let cleanup: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(cleanup.map((fn) => fn()));
    cleanup = [];
  });

  async function driftedDatabase(wishlistItemsType: 'jsonb[]' | 'json[]') {
    const database = await createDatabase({ blank: true });
    const client = new Client({ connectionString: database.url });
    await client.connect();
    cleanup.push(async () => {
      await client.end();
      await database.drop();
    });

    await applyMigrations(client, { until: ORDER_EVENTS });

    // What `db push` and years of old code left behind
    await client.query(`
      ALTER TABLE "Order" ADD COLUMN "orderStatus" TEXT DEFAULT 'Pending';
      ALTER TABLE "Order" ADD COLUMN "trackingNumber" TEXT;
      ALTER TABLE "Wishlist" ALTER COLUMN items TYPE ${wishlistItemsType} USING items::${wishlistItemsType};

      INSERT INTO "User" (id, email, "updatedAt") VALUES ('00000000-0000-4000-8000-000000000001', 'old@test.io', now());

      INSERT INTO "Order" (id, "userId", "shippingAddress", "paymentMethod", "itemsPrice", "shippingPrice", "taxPrice", "totalPrice",
                           "isPaid", "paidAt", "isDelivered", "deliveredAt", "orderStatus", "trackingNumber", "createdAt")
      VALUES
        -- typo'd status, paid but no payment time
        ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', '{}', 'Stripe', 1, 0, 0, 1,
         true, NULL, false, NULL, 'Shipppped', NULL, '2026-01-01'),
        -- Delivered status but the flag never set
        ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', '{}', 'Stripe', 1, 0, 0, 1,
         true, '2026-01-02', false, NULL, 'Delivered', 'TRK-OLD', '2026-01-02'),
        -- flagged delivered while only Shipped, and a payment time on an unpaid order
        ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', '{}', 'Stripe', 1, 0, 0, 1,
         false, '2026-01-03', true, '2026-01-04', 'Shipped', NULL, '2026-01-03'),
        -- no status at all
        ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000001', '{}', 'Stripe', 1, 0, 0, 1,
         false, NULL, false, NULL, NULL, NULL, '2026-01-04');

      INSERT INTO "Wishlist" (id, "sessionWishlistId", items, "updatedAt") VALUES (
        '00000000-0000-4000-8000-0000000000b1', 'w1',
        ARRAY[
          '"[object Object]"',
          '{"productId":"p1","name":"Lamp"}',
          to_jsonb('{"productId":"p2","name":"Desk"}'::text)::text,
          '{"name":"no product id"}'
        ]::${wishlistItemsType},
        now()
      );
    `);

    await applyMigrations(client, { from: ORDER_EVENTS });
    return client;
  }

  it.each(['jsonb[]', 'json[]'] as const)(
    'repairs every row when Wishlist.items is %s',
    async (itemsType) => {
      const db = await driftedDatabase(itemsType);

      const { rows: orders } = await db.query(`
        SELECT right(id::text, 2) AS id, "orderStatus"::text AS status, "isPaid", "paidAt" IS NOT NULL AS has_paid_at,
               "isDelivered", "deliveredAt" IS NOT NULL AS has_delivered_at
        FROM "Order" ORDER BY id`);
      expect(orders).toEqual([
        { id: 'a1', status: 'Pending', isPaid: true, has_paid_at: true, isDelivered: false, has_delivered_at: false },
        { id: 'a2', status: 'Delivered', isPaid: true, has_paid_at: true, isDelivered: true, has_delivered_at: true },
        { id: 'a3', status: 'Shipped', isPaid: false, has_paid_at: false, isDelivered: false, has_delivered_at: false },
        { id: 'a4', status: 'Pending', isPaid: false, has_paid_at: false, isDelivered: false, has_delivered_at: false },
      ]);

      const { rows: events } = await db.query(`
        SELECT right("orderId"::text, 2) AS id, string_agg(type::text, ',' ORDER BY type) AS types
        FROM "OrderEvent" GROUP BY "orderId" ORDER BY 1`);
      expect(events).toEqual([
        { id: 'a1', types: 'Created,Paid' },
        { id: 'a2', types: 'Created,Paid,Delivered' },
        { id: 'a3', types: 'Created,Shipped' },
        { id: 'a4', types: 'Created' },
      ]);

      const { rows: wishlist } = await db.query(
        `SELECT array_to_json(items) AS items FROM "Wishlist"`
      );
      expect(wishlist[0].items).toEqual([
        { productId: 'p1', name: 'Lamp' },
        { productId: 'p2', name: 'Desk' },
      ]);
    }
  );
});

describe('DB-08: migrations and schema.prisma agree', () => {
  it('a database built from the migrations needs no further changes', () => {
    const prismaCli = path.resolve(__dirname, '../../../node_modules/prisma/build/index.js');
    let diff = '';
    let status = 0;
    try {
      diff = execFileSync(
        process.execPath,
        [prismaCli, 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--script', '--exit-code'],
        // Pointed explicitly at the throwaway database, never the real one
        { env: { ...process.env, DATABASE_URL: migrated.url }, encoding: 'utf8', stdio: 'pipe' }
      );
    } catch (error) {
      const failure = error as { status: number; stdout: string; stderr: string };
      status = failure.status;
      diff = failure.stdout || failure.stderr;
    }

    expect(diff.trim() && status === 2 ? diff : '').toBe('');
    expect(status).toBe(0);
  });
});
