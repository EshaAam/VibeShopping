import 'server-only';

import { parsePage } from '@/lib/utils';
import { prisma } from '@/db/prisma';
import { Prisma } from '@prisma/client';
import { PAGE_SIZE } from '@/lib/constants';
import { requireAdmin, requireUser } from '@/lib/auth-guard';

// Read-only queries for server components. These are deliberately NOT server
// actions: a 'use server' export is a public POST endpoint, and reads have no
// reason to be one. `server-only` makes importing this from a client
// component a build error.

// Get user by ID - your own record, or anyone's if you're an admin.
// The password hash is never selected, so it can't leak into a client payload.
export async function getUserById(userId: string) {
  const session = await requireUser();
  if (session.user.id !== userId && session.user.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  const user = await prisma.user.findFirst({
    where: { id: userId },
    omit: { password: true },
  });

  if (!user) throw new Error('User not found');
  return user;
}

// Get all users
export async function getAllUsers({
  limit = PAGE_SIZE,
  page,
  query,
}: {
  limit?: number;
  page: number;
  query: string;
}) {
  await requireAdmin();

  const queryFilter: Prisma.UserWhereInput =
    query && query !== 'all'
      ? {
          name: {
            contains: query,
            mode: 'insensitive',
          } as Prisma.StringFilter,
        }
      : {};

  const data = await prisma.user.findMany({
    where: {
      ...queryFilter,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: (parsePage(page) - 1) * limit,
  });

  const dataCount = await prisma.user.count({
    where: {
      ...queryFilter,
    },
  });

  return {
    data,
    totalPages: Math.ceil(dataCount / limit),
  };
}
