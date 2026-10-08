import { auth } from '@/auth';
import { prisma } from '@/db/prisma';

// Server actions are public POST endpoints, so every action that touches
// someone's data or needs admin rights has to check the caller itself.
// Hiding a button or guarding a page is not enough.

export async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!session || !id) throw new Error('User is not authenticated');
  // Re-spread so callers get `user.id: string` rather than `string | undefined`
  return { ...session, user: { ...session.user, id } };
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  return session;
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
