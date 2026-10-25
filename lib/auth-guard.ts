import { auth } from '@/auth';
import { prisma } from '@/db/prisma';

// Server actions are public POST endpoints, so every action that touches
// someone's data or needs admin rights has to check the caller itself.
// Hiding a button or guarding a page is not enough.

export async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!session || !id) throw new Error('User is not authenticated');

  // The session is a 30-day JWT, so its role is a snapshot from sign-in.
  // Re-read the account: a demoted admin loses admin rights immediately, and a
  // deleted account stops working even while its cookie is still valid.
  const account = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!account) throw new Error('User is not authenticated');

  // Re-spread so callers get `user.id: string` and the current role
  return { ...session, user: { ...session.user, id, role: account.role } };
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  return session;
}

/** Non-throwing check for pages that redirect instead of erroring. */
export async function isAdmin() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

// Load an order the caller is allowed to act on. Someone else's order gets
// the same "not found" as a missing one, so ids can't be probed.
export async function requireOrderOwner(
  orderId: string,
  { allowAdmin = true }: { allowAdmin?: boolean } = {}
) {
  const session = await requireUser();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const isOwner = order?.userId === session.user.id;
  const isAdmin = allowAdmin && session.user.role === 'admin';
  if (!order || (!isOwner && !isAdmin)) throw new Error('Order not found');

  return { session, order };
}
