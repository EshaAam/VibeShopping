import fs from 'node:fs';
import path from 'node:path';
import type { Client } from 'pg';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../prisma/migrations');

/** Migration folder names in the order Prisma applies them. */
export function migrationNames(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Run the real migration SQL against `client`, the same files
 * `prisma migrate deploy` would run. `until` stops before that migration.
 */
export async function applyMigrations(
  client: Client,
  { from, until }: { from?: string; until?: string } = {}
) {
  for (const name of migrationNames()) {
    if (from && name < from) continue;
    if (until && name >= until) break;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
    try {
      await client.query(sql);
    } catch (error) {
      throw new Error(`Migration ${name} failed: ${(error as Error).message}`);
    }
  }
}
