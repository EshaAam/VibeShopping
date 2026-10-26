/**
 * Password sign-in had no attempt limit, so passwords could be guessed
 * forever. The limit lives in authorize() because Auth.js also exposes the
 * credentials provider directly, bypassing the sign-in form's action.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { userFindFirst } = vi.hoisted(() => ({ userFindFirst: vi.fn(async () => null) }));

vi.mock('@/db/prisma', () => ({ prisma: { user: { findFirst: userFindFirst } } }));
vi.mock('./db/prisma', () => ({ prisma: { user: { findFirst: userFindFirst } } }));
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));

type Authorize = (credentials: Record<string, string>, request: Request) => Promise<unknown>;

async function loadAuthorize() {
  // Attempts are counted in module memory - fresh copy per test.
  vi.resetModules();
  const { config, TooManySignInAttempts } = await import('@/auth');
  const provider = config.providers[0] as unknown as { options: { authorize: Authorize } };
  return { authorize: provider.options.authorize, TooManySignInAttempts };
}

const fromIp = (ip: string) => new Request('http://localhost', { headers: { 'x-forwarded-for': ip } });

beforeEach(() => vi.clearAllMocks());

describe('sign-in attempt limit', () => {
  it('blocks the 6th attempt on one email within 15 minutes', async () => {
    const { authorize, TooManySignInAttempts } = await loadAuthorize();
    const attempt = () => authorize({ email: 'Victim@Example.com', password: 'guess' }, fromIp('1.1.1.1'));

    for (let i = 0; i < 5; i++) await expect(attempt()).resolves.toBeNull();
    await expect(attempt()).rejects.toBeInstanceOf(TooManySignInAttempts);
  });

  it('counts an email the same regardless of case or spaces', async () => {
    const { authorize, TooManySignInAttempts } = await loadAuthorize();
    const variants = ['a@b.co', 'A@B.CO', ' a@b.co ', 'A@b.co', 'a@B.co', 'a@b.CO'];

    const results = await Promise.allSettled(
      variants.map((email) => authorize({ email, password: 'x' }, fromIp('2.2.2.2')))
    );
    expect(results.at(-1)).toMatchObject({ status: 'rejected' });
    expect((results.at(-1) as PromiseRejectedResult).reason).toBeInstanceOf(TooManySignInAttempts);
  });

  it('blocks one IP spraying many accounts', async () => {
    const { authorize, TooManySignInAttempts } = await loadAuthorize();

    for (let i = 0; i < 30; i++) {
      await authorize({ email: `user${i}@example.com`, password: 'x' }, fromIp('6.6.6.6'));
    }
    await expect(
      authorize({ email: 'one-more@example.com', password: 'x' }, fromIp('6.6.6.6'))
    ).rejects.toBeInstanceOf(TooManySignInAttempts);
  });

  it('does not let one attacker lock out other IPs on other accounts', async () => {
    const { authorize } = await loadAuthorize();

    for (let i = 0; i < 6; i++) {
      await authorize({ email: 'target@example.com', password: 'x' }, fromIp('6.6.6.6')).catch(() => {});
    }
    await expect(
      authorize({ email: 'someone-else@example.com', password: 'x' }, fromIp('8.8.8.8'))
    ).resolves.toBeNull();
  });
});
