import { auth } from '@/auth';

// Server actions are public POST endpoints, so every action that touches
// someone's data or needs admin rights has to check the caller itself.
// Hiding a button or guarding a page is not enough.

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('User is not authenticated');
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  return session;
}
