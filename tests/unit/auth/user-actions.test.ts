/**
 * Account actions where the input decides someone's access: an admin setting
 * a role, a customer editing their profile, and the sign-in form's messages.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  class TooManySignInAttempts extends Error {}
  return {
    TooManySignInAttempts,
    auth: vi.fn(),
    signIn: vi.fn(),
    liveRole: { value: 'admin' },
    userFindFirst: vi.fn(),
    userUpdate: vi.fn(),
  };
});

vi.mock('@/auth', () => ({
  auth: h.auth,
  signIn: h.signIn,
  signOut: vi.fn(),
  TooManySignInAttempts: h.TooManySignInAttempts,
}));
vi.mock('@/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: async () => ({ role: h.liveRole.value }),
      findFirst: h.userFindFirst,
      update: h.userUpdate,
    },
  },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: vi.fn(), delete: vi.fn() }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  savePaymentMethod,
  saveShippingAddress,
  signInWithCredentials,
  updateProfile,
  updateUser,
} from '@/lib/actions/user.actions';

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
  h.liveRole.value = 'admin';
});

describe('updateUser (admin)', () => {
  const edit = { id: 'user-1', name: 'Alice', email: 'alice@shop.io' };

  it('AUT-08: refuses a role that does not exist', async () => {
    expect(await updateUser({ ...edit, role: 'superadmin' })).toEqual({
      success: false,
      message: 'Invalid role',
    });
    expect(h.userUpdate).not.toHaveBeenCalled();
  });

  it('saves name and role only - the email is not editable here', async () => {
    expect((await updateUser({ ...edit, email: 'new@shop.io', role: 'admin' })).success).toBe(true);
    expect(h.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Alice', role: 'admin' },
    });
  });
});

describe('updateProfile (customer)', () => {
  it('AUT-09: changes the name but ignores an email sent with it', async () => {
    h.auth.mockResolvedValue({ user: { id: 'user-1', role: 'user' } });
    h.userFindFirst.mockResolvedValue({ id: 'user-1' });

    await updateProfile({ name: 'Alice B', email: 'attacker@evil.io' });

    expect(h.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Alice B' },
    });
  });
});

describe('checkout steps', () => {
  const address = {
    fullName: 'Alice Customer',
    streetAddress: '1 Main Street',
    city: 'Dhaka',
    postalCode: '1212',
    country: 'Bangladesh',
  };
  const redirectsTo = (path: string) =>
    expect.objectContaining({ digest: expect.stringContaining(`;${path};`) });

  beforeEach(() => {
    h.auth.mockResolvedValue({ user: { id: 'user-1', role: 'user' } });
    h.userFindFirst.mockResolvedValue({ id: 'user-1' });
  });

  it('saving the address moves on to the payment step from the server', async () => {
    await expect(saveShippingAddress(address)).rejects.toEqual(redirectsTo('/payment-method'));
    expect(h.userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { address } });
  });

  it('an invalid address stays on the page with the error', async () => {
    const res = await saveShippingAddress({ ...address, city: 'x' });
    expect(res.success).toBe(false);
    expect(h.userUpdate).not.toHaveBeenCalled();
  });

  it('saving the payment method moves on to review', async () => {
    await expect(savePaymentMethod({ type: 'Stripe' })).rejects.toEqual(redirectsTo('/place-order'));
  });

  it('an unknown payment method stays on the page with the error', async () => {
    const res = await savePaymentMethod({ type: 'Bitcoin' });
    expect(res.success).toBe(false);
    expect(h.userUpdate).not.toHaveBeenCalled();
  });
});

describe('signInWithCredentials', () => {
  const form = (email: string, password: string) => {
    const data = new FormData();
    data.set('email', email);
    data.set('password', password);
    return data;
  };

  it('AUT-10: a failed sign-in never says which part was wrong', async () => {
    h.signIn.mockRejectedValue(new Error('CredentialsSignin'));

    expect(await signInWithCredentials(null, form('alice@shop.io', 'wrong-password'))).toEqual({
      success: false,
      message: 'Invalid email or password',
    });
    // A malformed form gets the same message, not a validation error
    expect(await signInWithCredentials(null, form('not-an-email', 'x'))).toEqual({
      success: false,
      message: 'Invalid email or password',
    });
  });

  it('says so when the attempt limit is hit', async () => {
    h.signIn.mockRejectedValue(new h.TooManySignInAttempts());

    const res = await signInWithCredentials(null, form('alice@shop.io', 'guess-again'));

    expect(res.message).toMatch(/Too many sign-in attempts/);
  });
});
