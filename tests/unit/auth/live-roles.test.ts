/**
 * The session is a 30-day JWT, so its role is a snapshot from sign-in. A
 * demoted admin used to keep admin rights until it expired; the guard now
 * reads the account as it is now.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, userFindUnique } = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth }));
vi.mock('@/db/prisma', () => ({ prisma: { user: { findUnique: userFindUnique } } }));

import { isAdmin, requireAdmin, requireUser } from '@/lib/auth-guard';

beforeEach(() => vi.clearAllMocks());

describe('role comes from the database, not the sign-in snapshot', () => {
  it('rejects a demoted admin whose session still says admin', async () => {
    auth.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    userFindUnique.mockResolvedValue({ role: 'user' });

    await expect(requireAdmin()).rejects.toThrow(/admin access required/i);
    await expect(isAdmin()).resolves.toBe(false);
  });

  it('accepts a promoted user whose session still says user', async () => {
    auth.mockResolvedValue({ user: { id: 'u1', role: 'user' } });
    userFindUnique.mockResolvedValue({ role: 'admin' });

    await expect(requireAdmin()).resolves.toMatchObject({ user: { role: 'admin' } });
  });

  it('rejects a deleted account that still has a valid session cookie', async () => {
    auth.mockResolvedValue({ user: { id: 'gone', role: 'user' } });
    userFindUnique.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow(/not authenticated/i);
  });
});
