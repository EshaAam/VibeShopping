'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { calcPrice, formatError, convertToPlainObject } from '../utils';
import { auth } from '@/auth';
import { requireAdmin, requireUser } from '../auth-guard';
import { getMyCart } from './cart.actions';
import { getUserById } from './user.actions';
import { insertOrderSchema } from '../validator';
import { prisma } from '@/db/prisma';
import { CartItem } from '@/types';
import { PAGE_SIZE } from '../constants';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// Move an order to Cancelled and put its items back in stock. The status
// check in the WHERE clause makes this safe to call twice - only the call
// that actually flips the status restocks.
async function cancelAndRestock(orderId: string, fromStatus: string) {
  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.order.updateMany({
      where: { id: orderId, orderStatus: fromStatus },
      data: { orderStatus: 'Cancelled' },
    });
    if (cancelled.count === 0) {
      throw new Error('Order status changed, please refresh and try again');
    }

    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.qty } },
      });
    }
  });
}

// Create an order
export async function createOrder() {
  try {
    const session = await auth();
    if (!session) throw new Error('User is not authenticated');

    const cart = await getMyCart();
    const userId = session?.user?.id;
    if (!userId) throw new Error('User not found');

    const user = await getUserById(userId);

    if (!cart || cart.items.length === 0) {
      return { success: false, message: 'Your cart is empty', redirectTo: '/cart' };
    }
    if (!user.address) {
      return { success: false, message: 'Please add a shipping address', redirectTo: '/shipping-address' };
    }
    if (!user.paymentMethod) {
      return { success: false, message: 'Please select a payment method', redirectTo: '/payment-method' };
    }

    const insertedOrderId = await prisma.$transaction(async (tx) => {
      // Re-price every line from the database and reserve its stock. The
      // conditional decrement is atomic, so two buyers can't both get the last
      // unit - the second one updates zero rows and the order rolls back.
      const orderItems = [];
      for (const item of cart.items as CartItem[]) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) throw new Error(`${item.name} is no longer available`);

        const reserved = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        });
        if (reserved.count === 0) {
          throw new Error(`Not enough stock for ${product.name}`);
        }

        orderItems.push({
          productId: product.id,
          name: product.name,
          slug: product.slug,
          image: product.images[0],
          price: product.price,
          qty: item.qty,
        });
      }

      const order = insertOrderSchema.parse({
        userId: user.id,
        shippingAddress: user.address,
        paymentMethod: user.paymentMethod,
        ...calcPrice(orderItems),
      });

      const insertedOrder = await tx.order.create({ data: order });
      await tx.orderItem.createMany({
        data: orderItems.map((item) => ({
          ...item,
          orderId: insertedOrder.id,
        })),
      });
      await tx.cart.update({
        where: { id: cart.id },
        data: {
          items: [],
          totalPrice: 0,
          shippingPrice: 0,
          taxPrice: 0,
          itemsPrice: 0,
        },
      });

      return insertedOrder.id;
    });

    if (!insertedOrderId) throw new Error('Order not created');

    return { success: true, message: 'Order successfully created', redirectTo: `/order/${insertedOrderId}` };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, message: formatError(error) };
  }
}

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

// Mark an order as paid outside Stripe (cash on delivery). Admin only - the
// Stripe flow verifies payment itself in payment.actions.
export async function updateOrderToPaid(orderId: string) {
  try {
    await requireAdmin();

    const order = await prisma.order.findFirst({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.isPaid) throw new Error('Order is already paid');
    if (order.orderStatus === 'Cancelled') {
      throw new Error('Cannot mark a cancelled order as paid');
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        orderStatus: 'Processing', // Automatically move to Processing when paid
        paymentResult: {
          id: `COD_${Date.now()}`,
          status: 'COMPLETED',
          email_address: '',
          pricePaid: order.totalPrice.toString(),
        },
      },
    });

    revalidatePath(`/order/${orderId}`);

    return {
      success: true,
      message: 'Payment processed successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Update Order To Paid By COD
export async function updateOrderToPaidByCOD(orderId: string) {
  try {
    const res = await updateOrderToPaid(orderId);
    if (!res.success) return res;
    revalidatePath(`/order/${orderId}`);
    return { success: true, message: 'Order paid successfully' };
  } catch (err) {
    return { success: false, message: formatError(err) };
  }
}

// Update Order To Delivered
export async function deliverOrder(orderId: string) {
  try {
    await requireAdmin();

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
      },
    });

    if (!order) throw new Error('Order not found');
    if (!order.isPaid) throw new Error('Order is not paid');

    await prisma.order.update({
      where: { id: orderId },
      data: {
        isDelivered: true,
        deliveredAt: new Date(),
        orderStatus: 'Delivered', // Also update order status
      },
    });

    revalidatePath(`/order/${orderId}`);

    return { success: true, message: 'Order delivered successfully' };
  } catch (err) {
    return { success: false, message: formatError(err) };
  }
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
    skip: (page - 1) * limit,
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
    skip: (page - 1) * limit,
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
        to_char("createdAt", 'DD Mon') as "label",
        COALESCE(sum("totalPrice"), 0) as "totalSales",
        count(*) as "orderCount"
      FROM "Order" 
      WHERE "createdAt" >= NOW() - INTERVAL '14 days'
      GROUP BY to_char("createdAt", 'DD Mon'), DATE("createdAt")
      ORDER BY DATE("createdAt")
    `;
  } else if (timeRange === 'monthly') {
    // Get monthly sales for the last 12 months
    salesDataRaw = await prisma.$queryRaw`
      SELECT 
        to_char("createdAt", 'Mon YY') as "label",
        COALESCE(sum("totalPrice"), 0) as "totalSales",
        count(*) as "orderCount"
      FROM "Order" 
      WHERE "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY to_char("createdAt", 'Mon YY'), DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt")
    `;
  } else {
    // Get yearly sales
    salesDataRaw = await prisma.$queryRaw`
      SELECT 
        to_char("createdAt", 'YYYY') as "label",
        COALESCE(sum("totalPrice"), 0) as "totalSales",
        count(*) as "orderCount"
      FROM "Order" 
      GROUP BY to_char("createdAt", 'YYYY')
      ORDER BY to_char("createdAt", 'YYYY')
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
  const productsCount = await prisma.product.count();
  const usersCount = await prisma.user.count();

  // Calculate total sales
  const totalSales = await prisma.order.aggregate({
    _sum: { totalPrice: true },
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

// Delete Order
export async function deleteOrder(id: string) {
  try {
    await requireAdmin();

    await prisma.order.delete({ where: { id } });

    revalidatePath('/admin/orders');

    return {
      success: true,
      message: 'Order deleted successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Update Order Status (Admin)
export async function updateOrderStatus(
  orderId: string,
  newStatus: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled',
  trackingNumber?: string
) {
  try {
    await requireAdmin();

    const order = await prisma.order.findFirst({
      where: { id: orderId },
    });

    if (!order) throw new Error('Order not found');

    // Validate status transitions
    const currentStatus = order.orderStatus || 'Pending';
    const validTransitions: Record<string, string[]> = {
      Pending: ['Processing', 'Cancelled'],
      Processing: ['Shipped', 'Cancelled'],
      Shipped: ['Delivered'],
      Delivered: [],
      Cancelled: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Cannot change status from ${currentStatus} to ${newStatus}`);
    }

    // Prepare update data
    const updateData: {
      orderStatus: string;
      trackingNumber?: string;
      isDelivered?: boolean;
      deliveredAt?: Date;
    } = {
      orderStatus: newStatus,
    };

    // Add tracking number for shipped orders
    if (newStatus === 'Shipped' && trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    // Update isDelivered if status is Delivered
    if (newStatus === 'Delivered') {
      updateData.isDelivered = true;
      updateData.deliveredAt = new Date();
    }

    if (newStatus === 'Cancelled') {
      await cancelAndRestock(orderId, currentStatus);
    } else {
      await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });
    }

    revalidatePath(`/order/${orderId}`);
    revalidatePath('/admin/orders');

    return {
      success: true,
      message: `Order status updated to ${newStatus}`,
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Cancel Order (User - only before payment and shipment)
export async function cancelOrder(orderId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User is not authenticated');
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId },
    });

    if (!order) throw new Error('Order not found');

    // Check if the user owns this order (unless admin)
    if (order.userId !== session.user.id && session.user.role !== 'admin') {
      throw new Error('Unauthorized: You can only cancel your own orders');
    }

    // Users cannot cancel after payment (only admin can)
    if (order.isPaid && session.user.role !== 'admin') {
      throw new Error('Cannot cancel order: Order has already been paid. Please contact support.');
    }

    // Check if order can be cancelled (only Pending or Processing)
    const currentStatus = order.orderStatus || 'Pending';
    if (currentStatus !== 'Pending' && currentStatus !== 'Processing') {
      throw new Error('Cannot cancel order: Order has already been shipped or delivered');
    }

    await cancelAndRestock(orderId, currentStatus);

    revalidatePath(`/order/${orderId}`);
    revalidatePath('/user/orders');

    return {
      success: true,
      message: 'Order has been cancelled successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}
