import 'server-only';

import { auth } from '@/auth';
import { prisma } from '@/db/prisma';
import { Prisma } from '@prisma/client';
import { PAGE_SIZE } from '@/lib/constants';
import { convertToPlainObject, parsePage } from '@/lib/utils';
import { requireAdmin, requireUser } from '@/lib/auth-guard';

// Read-only queries for server components. These are deliberately NOT server
// actions: a 'use server' export is a public POST endpoint, and reads have no
// reason to be one. `server-only` makes importing this from a client
// component a build error.

// Get order by ID - only the customer who placed it, or an admin, can see it
export async function getOrderById(orderId: string) {
  const session = await requireUser();

  const data = await prisma.order.findFirst({
    where: {
      id: orderId,
    },
    include: {
      orderItems: true,
      user: { select: { name: true, email: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (
    !data ||
    (data.userId !== session.user.id && session.user.role !== 'admin')
  ) {
    return null;
  }

  return convertToPlainObject(data);
}

// Get User Orders 
// with pagination
export async function getMyOrders({
  limit = PAGE_SIZE,
  page,
}: {
  limit?: number;
  page: number;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('User is not authenticated');

  const data = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: (parsePage(page) - 1) * limit,
    include: {
      orderItems: true,
      user: { select: { name: true, email: true } },
    },
  });

  const dataCount = await prisma.order.count({
    where: { userId: session.user.id },
  });

  return {
    data: convertToPlainObject(data),
    totalPages: Math.ceil(dataCount / limit),
  };
}

// Get All Orders (Admin)
export async function getAllOrders({
  limit = PAGE_SIZE,
  page,
  query,
}: {
  query: string;
  limit?: number;
  page: number;
}) {
  await requireAdmin();

  const queryFilter: Prisma.OrderWhereInput =
    query && query !== 'all'
      ? {
          user: {
            name: {
              contains: query,
              mode: 'insensitive',
            } as Prisma.StringFilter,
          },
        }
      : {};

  const data = await prisma.order.findMany({
    where: {
      ...queryFilter,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: (parsePage(page) - 1) * limit,
    include: {
      orderItems: true,
      user: {
        select: { name: true, email: true },
      },
    },
  });

  const dataCount = await prisma.order.count({
    where: {
      ...queryFilter,
    },
  });

  return {
    data: convertToPlainObject(data),
    totalPages: Math.ceil(dataCount / limit),
  };
}

// Get sales chart data based on time range
export async function getSalesChartData(
  timeRange: 'daily' | 'monthly' | 'yearly'
) {
  await requireAdmin();

  let salesDataRaw: Array<{
    label: string;
    totalSales: Prisma.Decimal;
    orderCount: bigint;
  }>;

  if (timeRange === 'daily') {
    // Get daily sales for the last 14 days
    salesDataRaw = await prisma.$queryRaw`
      SELECT 
        to_char("paidAt", 'DD Mon') as "label",
        COALESCE(sum("totalPrice"), 0) as "totalSales",
        count(*) as "orderCount"
      FROM "Order" 
      WHERE "paidAt" >= NOW() - INTERVAL '14 days'
        AND "orderStatus" <> 'Cancelled'
      GROUP BY to_char("paidAt", 'DD Mon'), DATE("paidAt")
      ORDER BY DATE("paidAt")
    `;
  } else if (timeRange === 'monthly') {
    // Get monthly sales for the last 12 months
    salesDataRaw = await prisma.$queryRaw`
      SELECT 
        to_char("paidAt", 'Mon YY') as "label",
        COALESCE(sum("totalPrice"), 0) as "totalSales",
        count(*) as "orderCount"
      FROM "Order" 
      WHERE "paidAt" >= NOW() - INTERVAL '12 months'
        AND "orderStatus" <> 'Cancelled'
      GROUP BY to_char("paidAt", 'Mon YY'), DATE_TRUNC('month', "paidAt")
      ORDER BY DATE_TRUNC('month', "paidAt")
    `;
  } else {
    // Get yearly sales
    salesDataRaw = await prisma.$queryRaw`
      SELECT 
        to_char("paidAt", 'YYYY') as "label",
        COALESCE(sum("totalPrice"), 0) as "totalSales",
        count(*) as "orderCount"
      FROM "Order" 
      WHERE "paidAt" IS NOT NULL AND "orderStatus" <> 'Cancelled'
      GROUP BY to_char("paidAt", 'YYYY')
      ORDER BY to_char("paidAt", 'YYYY')
    `;
  }

  return salesDataRaw.map((entry) => ({
    label: entry.label,
    totalSales: Number(entry.totalSales),
    orderCount: Number(entry.orderCount),
  }));
}

// Get sales data and order summary
export async function getOrderSummary() {
  await requireAdmin();

  // Get counts for each resource
  const ordersCount = await prisma.order.count();
  const productsCount = await prisma.product.count({
    where: { archivedAt: null },
  });
  const usersCount = await prisma.user.count();

  // Calculate total sales - unpaid and cancelled orders aren't revenue
  const totalSales = await prisma.order.aggregate({
    _sum: { totalPrice: true },
    where: { isPaid: true, orderStatus: { not: 'Cancelled' } },
  });

  // Get daily sales (default view) for the last 14 days
  const salesData = await getSalesChartData('daily');

  // Get latest sales
  const latestOrders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true } },
    },
    take: 6,
  });

  return {
    ordersCount,
    productsCount,
    usersCount,
    totalSales,
    latestOrders,
    salesData,
  };
}
