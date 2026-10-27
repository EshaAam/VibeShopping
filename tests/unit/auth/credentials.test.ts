/**
 * Password sign-in (authorize) and the JWT callback that fills in a default
 * display name. Every failure looks the same from outside, so the response
 * can't be used to find out which emails have accounts.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSync } from 'bcrypt-ts-edge';

const { userFindFirst, userUpdate, compareSync } = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  compareSync: vi.fn(),
}));

vi.mock('@/db/prisma', () => ({
  prisma: { user: { findFirst: userFindFirst, update: userUpdate } },
}));
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));
// Real bcrypt, watched: the test needs to see whether a comparison happened
vi.mock('bcrypt-ts-edge', async (importOriginal) => {
  const real = await importOriginal<typeof import('bcrypt-ts-edge')>();
  compareSync.mockImplementation(real.compareSync);
  return { ...real, compareSync };
});

type Authorize = (credentials: Record<string, string>, request: Request) => Promise<unknown>;
type Jwt = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

async function load() {
  // Sign-in attempts are rate limited in module memory - fresh copy per test.
  vi.resetModules();
  const { config } = await import('@/auth');
  const provider = config.providers[0] as unknown as { options: { authorize: Authorize } };
  return { authorize: provider.options.authorize, jwt: config.callbacks.jwt as Jwt };
}

const request = new Request('http://localhost', { headers: { 'x-forwarded-for': '1.1.1.1' } });
const PASSWORD_HASH = hashSync('correct horse', 4);

const account = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@shop.io',
  role: 'user',
  password: PASSWORD_HASH,
};

// The first import of Auth.js is slow (transform + init); pay it once here so
// the per-test module reloads below are quick and tests measure only themselves.
beforeAll(async () => {
  await import('@/auth');
}, 30_000);

beforeEach(() => vi.clearAllMocks());

describe('authorize', () => {
  it('AUT-10: returns the user, without the password hash, for the right password', async () => {
    userFindFirst.mockResolvedValue(account);
    const { authorize } = await load();

    expect(await authorize({ email: 'alice@shop.io', password: 'correct horse' }, request)).toEqual({
      id: 'user-1',
      name: 'Alice',
      email: 'alice@shop.io',
      role: 'user',
    });
  });

  it.each([
    ['a wrong password', account, 'wrong'],
    ['an unknown email', null, 'correct horse'],
    ['an account with no password (OAuth only)', { ...account, password: null }, 'correct horse'],
  ])('AUT-10: %s gets the same null as every other failure', async (_, found, password) => {
    userFindFirst.mockResolvedValue(found);
    const { authorize } = await load();

    expect(await authorize({ email: 'alice@shop.io', password }, request)).toBeNull();
  });

  // Regression: an unknown email skipped bcrypt and answered measurably faster
  // than a wrong password, which told an attacker which emails have accounts.
  it.each([
    ['an unknown email', null],
    ['an account with no password', { ...account, password: null }],
  ])('AUT-10: %s still costs one full-strength bcrypt comparison', async (_, found) => {
    userFindFirst.mockResolvedValue(found);
    const { authorize } = await load();

    await authorize({ email: 'ghost@shop.io', password: 'guess' }, request);

    expect(compareSync).toHaveBeenCalledTimes(1);
    // Same cost factor as real password hashes (10), so it takes as long
    expect(compareSync.mock.calls[0][1]).toMatch(/^\$2[aby]\$10\$/);
  });
});

describe('jwt callback', () => {
  it('AUT-11: a user still named No_Name gets their email name, saved to the account', async () => {
    const { jwt } = await load();

    const token = await jwt({
      token: {},
      user: { id: 'user-1', name: 'No_Name', email: 'alice@shop.io', role: 'user' },
    });

    expect(token).toMatchObject({ id: 'user-1', role: 'user', name: 'alice' });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { name: 'alice' } });
  });

  it('leaves a real name alone', async () => {
    const { jwt } = await load();

    await jwt({ token: {}, user: { id: 'user-1', name: 'Alice', email: 'alice@shop.io', role: 'user' } });

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('a profile update renames the session', async () => {
    const { jwt } = await load();

    const token = await jwt({
      token: { name: 'Alice' },
      trigger: 'update',
      session: { user: { name: 'Alice B' } },
    });

    expect(token.name).toBe('Alice B');
  });
});
