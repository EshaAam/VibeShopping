/**
 * Integration tests run the app's real code against a real Postgres. Only the
 * framework edges are replaced: the database client points at this file's test
 * database, and the request (session, cookies) comes from helpers/request.ts.
 * `@/auth` is mocked per file, because the sign-in tests need the real one.
 */
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', async () => (await import('../helpers/request')).nextHeaders);
vi.mock('@/db/prisma', async () => ({ prisma: (await import('../helpers/db')).prisma }));
vi.mock('@/lib/stripe', () => ({ stripe: {} }));
