import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { markOrderPaid } from '@/lib/payments';

// Stripe calls this after a payment settles, whether or not the customer's
// tab is still open. It is the authoritative writer for Stripe orders; the
// client-side confirm only makes the UI update faster.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // The signature covers the raw body, so read it as text before parsing.
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch (error) {
    console.error('[stripe webhook] signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    try {
      const result = await markOrderPaid(event.data.object);
      if (result.status === 'rejected') {
        // Retrying won't change the answer, so acknowledge it and log loudly.
        console.error(
          `[stripe webhook] ${event.id} rejected: ${result.reason}`
        );
      }
    } catch (error) {
      // Unexpected failure (e.g. database down) - a 500 makes Stripe retry.
      console.error(`[stripe webhook] ${event.id} failed:`, error);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
