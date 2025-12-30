'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { formatError, convertToPlainObject } from '../utils';
import { auth } from '@/auth';
import { getMyCart } from './cart.actions';
import { getUserById } from './user.actions';
import { insertOrderSchema } from '../validator';
import { prisma } from '@/db/prisma';
import { CartItem } from '@/types';
import { PAGE_SIZE } from '../constants';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

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

    const order = insertOrderSchema.parse({
      userId: user.id,
      shippingAddress: user.address,
      paymentMethod: user.paymentMethod,
      itemsPrice: cart.itemsPrice,
      shippingPrice: cart.shippingPrice,
      taxPrice: cart.taxPrice,
      totalPrice: cart.totalPrice,
    });

    const insertedOrderId = await prisma.$transaction(async (tx) => {
      const insertedOrder = await tx.order.create({ data: order });
      for (const item of cart.items as CartItem[]) {
        await tx.orderItem.create({
          data: {
            ...item,
            price: item.price,
            orderId: insertedOrder.id,
          },
        });
      }
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

// Get order by ID
export async function getOrderById(orderId: string) {
  const data = await prisma.order.findFirst({
    where: {
      id: orderId,
    },
    include: {
      orderItems: true,
      user: { select: { name: true, email: true } },
    },
  });
  return convertToPlainObject(data);
}

// Update order to paid (Mock Payment)
export async function updateOrderToPaid(orderId: string) {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        orderStatus: 'Processing', // Automatically move to Processing when paid
        paymentResult: {
          id: `MOCK_${Date.now()}`,
          status: 'COMPLETED',
          email_address: 'customer@example.com',
          pricePaid: '0.00',
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
    await updateOrderToPaid(orderId);
    revalidatePath(`/order/${orderId}`);
    return { success: true, message: 'Order paid successfully' };
  } catch (err) {
    return { success: false, message: formatError(err) };
  }
}

// Update Order To Delivered
export async function deliverOrder(orderId: string) {
  try {
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

type SalesDataType = {
  month: string;
  totalSales: number;
}[];

// Get sales data and order summary
export async function getOrderSummary() {
  // Get counts for each resource
  const ordersCount = await prisma.order.count();
  const productsCount = await prisma.product.count();
  const usersCount = await prisma.user.count();

  // Calculate total sales
  const totalSales = await prisma.order.aggregate({
    _sum: { totalPrice: true },
  });

  // Get monthly sales
  const salesDataRaw = await prisma.$queryRaw<
    Array<{ month: string; totalSales: Prisma.Decimal }>
  >`SELECT to_char("createdAt", 'MM/YY') as "month", sum("totalPrice") as "totalSales" FROM "Order" GROUP BY to_char("createdAt", 'MM/YY') ORDER BY to_char("createdAt", 'MM/YY')`;

  const salesData: SalesDataType = salesDataRaw.map((entry) => ({
    month: entry.month,
    totalSales: Number(entry.totalSales), // Convert Decimal to number
  }));

  console.log('Sales Data:', salesData); // Debug log

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
    const session = await auth();
    if (!session?.user?.role || session.user.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }

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

    await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

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

// Cancel Order (User - only before shipment)
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

    // Check if order can be cancelled (only Pending or Processing)
    const currentStatus = order.orderStatus || 'Pending';
    if (currentStatus !== 'Pending' && currentStatus !== 'Processing') {
      throw new Error('Cannot cancel order: Order has already been shipped or delivered');
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'Cancelled',
      },
    });

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
