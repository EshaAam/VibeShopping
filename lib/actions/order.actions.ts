'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { calcPrice, formatError } from '../utils';
import { auth } from '@/auth';
import { requireAdmin, requireOrderOwner } from '../auth-guard';
import { getSalesChartData as querySalesChartData } from '@/lib/data/order';
import { getMyCart } from '@/lib/data/cart';
import { getUserById } from '@/lib/data/user';
import { insertOrderSchema } from '../validator';
import { prisma } from '@/db/prisma';
import { CartItem } from '@/types';
import { revalidatePath } from 'next/cache';
import { createOrderRecord, recordPayment, transitionOrder } from '@/lib/orders';

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
        if (!product || product.archivedAt) {
          throw new Error(`${item.name} is no longer available`);
        }

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

      const insertedOrder = await createOrderRecord(tx, order, user.id);
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

// Mark an order as paid outside Stripe (cash on delivery). Admin only - the
// Stripe flow verifies payment itself in payment.actions.
export async function updateOrderToPaid(orderId: string) {
  try {
    const session = await requireAdmin();

    const order = await prisma.order.findFirst({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.isPaid) throw new Error('Order is already paid');
    if (order.orderStatus === 'Cancelled') {
      throw new Error('Cannot mark a cancelled order as paid');
    }

    const paid = await prisma.$transaction((tx) =>
      recordPayment(tx, orderId, {
        actorId: session.user.id,
        paymentResult: {
          id: `COD_${Date.now()}`,
          status: 'COMPLETED',
          email_address: '',
          pricePaid: order.totalPrice.toString(),
        },
      })
    );
    if (!paid) throw new Error('Order is already paid or was cancelled');

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
    const session = await requireAdmin();

    const order = await prisma.order.findFirst({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (!order.isPaid) throw new Error('Order is not paid');

    await prisma.$transaction((tx) =>
      transitionOrder(tx, orderId, 'Delivered', { actorId: session.user.id })
    );

    revalidatePath(`/order/${orderId}`);

    return { success: true, message: 'Order delivered successfully' };
  } catch (err) {
    return { success: false, message: formatError(err) };
  }
}

// Update Order Status (Admin)
export async function updateOrderStatus(
  orderId: string,
  newStatus: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled',
  trackingNumber?: string
) {
  try {
    const session = await requireAdmin();

    if (newStatus === 'Pending') {
      throw new Error('Cannot move an order back to Pending');
    }

    // Validation, the status update and the history row all happen together
    await prisma.$transaction((tx) =>
      transitionOrder(tx, orderId, newStatus, {
        actorId: session.user.id,
        trackingNumber,
      })
    );

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
    // Only the customer who placed it, or an admin
    const { session, order } = await requireOrderOwner(orderId);

    // Users cannot cancel after payment (only admin can)
    if (order.isPaid && session.user.role !== 'admin') {
      throw new Error('Cannot cancel order: Order has already been paid. Please contact support.');
    }

    // Check if order can be cancelled (only Pending or Processing)
    const currentStatus = order.orderStatus || 'Pending';
    if (currentStatus !== 'Pending' && currentStatus !== 'Processing') {
      throw new Error('Cannot cancel order: Order has already been shipped or delivered');
    }

    await prisma.$transaction((tx) =>
      transitionOrder(tx, orderId, 'Cancelled', { actorId: session.user.id })
    );

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

// Sales chart data for the admin overview - kept as an action because the
// chart's range picker refetches it from the client.
export async function getSalesChartData(
  timeRange: 'daily' | 'monthly' | 'yearly'
) {
  return querySalesChartData(timeRange);
}
