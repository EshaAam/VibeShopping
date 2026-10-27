/**
 * The chat assistant in the browser, and the Stripe webhook over real HTTP.
 *
 * The e2e server runs without Gemini keys, so the chat answers through its
 * no-AI paths: deterministic, free, and exactly what customers get when the
 * quota runs out. Model quality is measured separately (AI-22).
 *
 * The webhook test signs events with the same secret the server was given,
 * the way Stripe does, so the real route verifies the real signature.
 */
import { expect, test } from '@playwright/test';
import Stripe from 'stripe';
import { insertOrder, resetDatabase, sql, type Seeded } from './support/db';

let seeded: Seeded;
test.beforeEach(async () => {
  seeded = await resetDatabase();
});

test('E2E-06: the chat answers, and every product it links to opens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open chat' }).click();
  const input = page.getByPlaceholder('Ask me anything...');
  const replies = page.locator('.whitespace-pre-wrap');

  await input.fill('hi');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(replies.last()).toContainText("I'm the VibeShopping assistant");

  await input.fill('gaming laptops under $1500');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(replies.last()).toContainText(seeded.products.laptop.name);

  const answer = (await replies.last().textContent()) ?? '';
  const links = [...answer.matchAll(/\/product\/[a-z0-9-]+/g)].map((m) => m[0]);
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    await page.goto(link);
    await expect(page.getByText('Could not find requested resource')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test.describe('Stripe webhook', () => {
  const stripe = new Stripe('sk_test_signing_only');
  const SECRET = 'whsec_e2e_test_secret';

  function signedEvent(orderId: string, amountCents: number, id = 'evt_e2e_1') {
    const payload = JSON.stringify({
      id,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_e2e_1',
          object: 'payment_intent',
          status: 'succeeded',
          amount_received: amountCents,
          currency: 'usd',
          metadata: { orderId },
        },
      },
    });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    return { data: payload, headers: { 'stripe-signature': signature, 'content-type': 'application/json' } };
  }

  const eventsOf = async (orderId: string) =>
    (await sql<{ type: string }>(`SELECT type FROM "OrderEvent" WHERE "orderId" = $1 ORDER BY "createdAt"`, [orderId])).map(
      (e) => e.type
    );

  test('PAY-16: a signed payment_intent.succeeded marks the order paid, once', async ({ request }) => {
    const order = await insertOrder(seeded.customer.id, seeded.products.lamp, { total: '56.00' });

    const first = await request.post('/api/webhooks/stripe', signedEvent(order.id, 5600));
    const retry = await request.post('/api/webhooks/stripe', signedEvent(order.id, 5600, 'evt_e2e_retry'));

    expect(first.status()).toBe(200);
    expect(retry.status()).toBe(200);
    const [row] = await sql<{ isPaid: boolean; orderStatus: string }>(
      `SELECT "isPaid", "orderStatus" FROM "Order" WHERE id = $1`,
      [order.id]
    );
    expect(row).toEqual({ isPaid: true, orderStatus: 'Processing' });
    expect(await eventsOf(order.id)).toEqual(['Created', 'Paid', 'Processing']);
  });

  test('a forged signature is refused and changes nothing', async ({ request }) => {
    const order = await insertOrder(seeded.customer.id, seeded.products.lamp);
    const event = signedEvent(order.id, 5600);

    const res = await request.post('/api/webhooks/stripe', {
      data: event.data,
      headers: { ...event.headers, 'stripe-signature': 't=1,v1=forged' },
    });

    expect(res.status()).toBe(400);
    expect(await eventsOf(order.id)).toEqual(['Created']);
  });

  test('a short payment is acknowledged (no retry) but does not mark the order paid', async ({ request }) => {
    const order = await insertOrder(seeded.customer.id, seeded.products.lamp, { total: '56.00' });

    const res = await request.post('/api/webhooks/stripe', signedEvent(order.id, 100));

    expect(res.status()).toBe(200);
    expect(await eventsOf(order.id)).toEqual(['Created']);
  });
});
