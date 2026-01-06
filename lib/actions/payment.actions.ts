'use server';

import { stripe } from '@/lib/stripe';
import { prisma } from '@/db/prisma';
import { auth } from '@/auth';
import { formatError } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

// Create Stripe Payment Intent for an order
export async function createStripePaymentIntent(orderId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User is not authenticated');
    }

    // Get the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.userId !== session.user.id) {
      throw new Error('Unauthorized');
    }

    if (order.isPaid) {
      throw new Error('Order is already paid');
    }

    // Convert totalPrice to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(Number(order.totalPrice) * 100);

    // Create a Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        orderId: order.id,
        userId: order.userId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Confirm Stripe payment and update order
export async function confirmStripePayment(
  orderId: string,
  paymentIntentId: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User is not authenticated');
    }

    // Verify the payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment not successful');
    }

    // Verify the order matches
    if (paymentIntent.metadata.orderId !== orderId) {
      throw new Error('Payment intent does not match order');
    }

    // Get the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.isPaid) {
      return { success: true, message: 'Order already paid' };
    }

    // Update order to paid
    await prisma.order.update({
      where: { id: orderId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        orderStatus: 'Processing',
        paymentResult: {
          id: paymentIntentId,
          status: paymentIntent.status,
          email_address: session.user.email || '',
          pricePaid: (paymentIntent.amount / 100).toFixed(2),
        },
      },
    });

    revalidatePath(`/order/${orderId}`);

    return {
      success: true,
      message: 'Payment successful! Your order is being processed.',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// Get Stripe payment status for an order
export async function getStripePaymentStatus(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        isPaid: true,
        paymentResult: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return {
      success: true,
      isPaid: order.isPaid,
      paymentResult: order.paymentResult,
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}
