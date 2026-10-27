/**
 * The money paths, in a real browser against Stripe's test mode: a guest
 * becomes a customer and pays by card, and a declined card leaves the order
 * unpaid and payable again.
 */
import { expect, test } from '@playwright/test';
import { insertOrder, resetDatabase, sql, type Seeded } from './support/db';
import { addToCart, fillShippingAddress, payWithCard, signIn } from './support/pages';

let seeded: Seeded;
test.beforeEach(async () => {
  seeded = await resetDatabase();
});

test('E2E-01: guest shops, signs up, keeps the cart, pays by card', async ({ page }) => {
  const { lamp, laptop } = seeded.products;

  // Shopping as a guest
  await addToCart(page, lamp.slug);
  await addToCart(page, laptop.slug);

  // Signing up hands the guest cart to the new account
  const email = `new-${Date.now()}@e2e.test`;
  await page.goto('/sign-up');
  await page.getByLabel('Name').fill('Sam Newcomer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Passw0rd!');
  await page.getByLabel('Confirm Password').fill('Passw0rd!');
  await page.locator('form').getByRole('button', { name: 'Sign Up' }).click();
  await expect(page).not.toHaveURL(/\/sign-up/);

  await page.goto('/cart');
  await expect(page.getByRole('link', { name: lamp.name })).toBeVisible();
  await expect(page.getByRole('link', { name: laptop.name })).toBeVisible();

  // Checkout: a new customer has no saved address yet
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await fillShippingAddress(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Stripe').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/\/order\/[0-9a-f-]{36}$/);
  const orderId = page.url().split('/').pop()!;

  // 45 + 1299 = 1344, free shipping, 15% tax = 1545.60
  await expect(page.getByRole('button', { name: 'Purchase $1,545.60' })).toBeVisible();
  await payWithCard(page, '4242 4242 4242 4242');
  await expect(page.getByText('Payment Successful!').first()).toBeVisible({ timeout: 45_000 });

  await page.reload();
  await expect(page.getByText(/^Paid at/)).toBeVisible();
  const [order] = await sql<{ orderStatus: string; isPaid: boolean }>(
    `SELECT "orderStatus", "isPaid" FROM "Order" WHERE id = $1`,
    [orderId]
  );
  expect(order).toEqual({ orderStatus: 'Processing', isPaid: true });
});

test('E2E-02: a declined card leaves the order unpaid and payable', async ({ page }) => {
  const order = await insertOrder(seeded.customer.id, seeded.products.lamp);
  await signIn(page, seeded.customer.email);
  await page.goto(`/order/${order.id}`);

  await payWithCard(page, '4000 0000 0000 9995');

  await expect(page.getByText(/insufficient funds/i).first()).toBeVisible({ timeout: 45_000 });
  await page.reload();
  await expect(page.getByText('Not paid')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Purchase/ })).toBeVisible();
  const [row] = await sql<{ isPaid: boolean }>(`SELECT "isPaid" FROM "Order" WHERE id = $1`, [order.id]);
  expect(row.isPaid).toBe(false);
});
