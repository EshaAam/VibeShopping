import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { hashSync } from 'bcrypt-ts-edge';

/** The throwaway database support/server.mjs starts. Never a real one. */
const DATABASE_URL = 'postgresql://postgres:e2e@127.0.0.1:54329/postgres';

export const PASSWORD = 'Passw0rd!';
const PASSWORD_HASH = hashSync(PASSWORD, 10);

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

const PRODUCTS = [
  { key: 'lamp', name: 'E2E Desk Lamp', category: 'Lighting', brand: 'Lumen', price: '45.00', stock: 5 },
  { key: 'laptop', name: 'E2E Gaming Laptop', category: 'Laptop', brand: 'Acer', price: '1299.00', stock: 3 },
  { key: 'lantern', name: 'E2E Last Lantern', category: 'Lighting', brand: 'Lumen', price: '30.00', stock: 1 },
] as const;

export type Seeded = Awaited<ReturnType<typeof resetDatabase>>;

/**
 * Empty every table and add a known catalog plus two accounts. Emails are new
 * each time, so the sign-in rate limit (per email) never carries across tests.
 */
export async function resetDatabase() {
  await sql(`TRUNCATE "OrderEvent", "OrderItem", "Order", "Review", "Cart", "Wishlist",
                      "Product", "Account", "Session", "VerificationToken", "User" CASCADE`);

  const run = randomUUID().slice(0, 8);
  const address = {
    fullName: 'Jane Customer',
    streetAddress: '1 Main Street',
    city: 'Dhaka',
    postalCode: '1212',
    country: 'Bangladesh',
  };

  const [admin] = await sql<{ id: string; email: string }>(
    `INSERT INTO "User" (name, email, password, role, "updatedAt")
     VALUES ('Ada Admin', $1, $2, 'admin', now()) RETURNING id, email`,
    [`admin-${run}@e2e.test`, PASSWORD_HASH]
  );
  const [customer] = await sql<{ id: string; email: string }>(
    `INSERT INTO "User" (name, email, password, role, address, "paymentMethod", "updatedAt")
     VALUES ('Jane Customer', $1, $2, 'user', $3, 'CashOnDelivery', now()) RETURNING id, email`,
    [`jane-${run}@e2e.test`, PASSWORD_HASH, JSON.stringify(address)]
  );

  const products = {} as Record<(typeof PRODUCTS)[number]['key'], { id: string; slug: string; name: string }>;
  for (const p of PRODUCTS) {
    const slug = p.name.toLowerCase().replace(/\s+/g, '-');
    const [row] = await sql<{ id: string; slug: string; name: string }>(
      `INSERT INTO "Product" (name, slug, category, brand, description, images, price, stock, rating, "numReviews")
       VALUES ($1, $2, $3, $4, 'Seeded for end-to-end tests', ARRAY['/images/sample-products/p1-1.jpg'], $5, $6, 4.5, 3)
       RETURNING id, slug, name`,
      [p.name, slug, p.category, p.brand, p.price, p.stock]
    );
    products[p.key] = row;
  }

  return { admin, customer, products };
}

/** An order written straight to the database, for tests that start after checkout. */
export async function insertOrder(
  userId: string,
  product: { id: string; name: string; slug: string },
  { paymentMethod = 'Stripe', total = '56.00' } = {}
) {
  const [order] = await sql<{ id: string }>(
    `INSERT INTO "Order" ("userId", "shippingAddress", "paymentMethod", "itemsPrice", "shippingPrice", "taxPrice", "totalPrice")
     VALUES ($1, '{"fullName":"Jane Customer","streetAddress":"1 Main Street","city":"Dhaka","postalCode":"1212","country":"Bangladesh"}',
             $2, 40, 10, 6, $3) RETURNING id`,
    [userId, paymentMethod, total]
  );
  await sql(
    `INSERT INTO "OrderItem" ("orderId", "productId", qty, price, name, slug, image)
     VALUES ($1, $2, 1, 40, $3, $4, '/images/sample-products/p1-1.jpg')`,
    [order.id, product.id, product.name, product.slug]
  );
  await sql(`INSERT INTO "OrderEvent" ("orderId", type, "actorId") VALUES ($1, 'Created', $2)`, [order.id, userId]);
  return order;
}

export async function stockOf(productId: string) {
  const [row] = await sql<{ stock: number }>(`SELECT stock FROM "Product" WHERE id = $1`, [productId]);
  return row.stock;
}
