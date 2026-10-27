import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { createPrisma, type AppPrismaClient } from '@/db/client';

let current: AppPrismaClient | undefined;

/**
 * Stands in for `@/db/prisma` (see setup/mocks.ts): app code imports this and
 * reaches whichever test database the running file created.
 */
export const prisma = new Proxy({} as AppPrismaClient, {
  get(_, key) {
    if (!current) throw new Error('No test database - call setupTestDatabase() in this file');
    const value = Reflect.get(current, key);
    return typeof value === 'function' ? value.bind(current) : value;
  },
});

function adminClient() {
  return new Client({ connectionString: inject('pgAdminUrl') });
}

function urlFor(database: string) {
  const url = new URL(inject('pgAdminUrl'));
  url.pathname = `/${database}`;
  return url.toString();
}

/** A new, empty database: from the migrated template, or blank. */
export async function createDatabase({ blank = false } = {}) {
  const name = `test_${randomUUID().replace(/-/g, '')}`;
  const admin = adminClient();
  await admin.connect();
  try {
    // Postgres refuses to copy a template two sessions are copying at once
    await admin.query('SELECT pg_advisory_lock(4242)');
    await admin.query(`CREATE DATABASE ${name} TEMPLATE ${blank ? 'template0' : 'vibe_template'}`);
  } finally {
    await admin.query('SELECT pg_advisory_unlock(4242)').catch(() => {});
    await admin.end();
  }

  return {
    name,
    url: urlFor(name),
    async drop() {
      const dropper = adminClient();
      await dropper.connect();
      await dropper.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await dropper.end();
    },
  };
}

const TABLES = [
  'OrderEvent',
  'OrderItem',
  'Order',
  'Review',
  'Cart',
  'Wishlist',
  'Product',
  'Account',
  'Session',
  'VerificationToken',
  'User',
];

/**
 * Give this test file its own migrated database, emptied before each test.
 * TRUNCATE skips the row triggers that forbid deleting orders and events.
 */
export function setupTestDatabase() {
  let database: Awaited<ReturnType<typeof createDatabase>>;

  beforeAll(async () => {
    database = await createDatabase();
    current = createPrisma(new PrismaPg({ connectionString: database.url }));
  });

  beforeEach(async () => {
    await current!.$executeRawUnsafe(
      `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`
    );
  });

  afterAll(async () => {
    await current?.$disconnect();
    current = undefined;
    await database?.drop();
  });

  return {
    get url() {
      return database.url;
    },
  };
}
