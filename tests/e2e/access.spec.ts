/**
 * Who can open what, checked through the real middleware and pages: signed-out
 * visitors, customers poking at the admin area or someone else's order, and
 * what a public share link exposes.
 */
import { expect, test } from '@playwright/test';
import { insertOrder, resetDatabase, sql, type Seeded } from './support/db';
import { addToCart, signIn } from './support/pages';

let seeded: Seeded;
test.beforeEach(async () => {
  seeded = await resetDatabase();
});

test('E2E-05: a signed-out visitor is sent to sign in', async ({ page }) => {
  const order = await insertOrder(seeded.customer.id, seeded.products.lamp);
  for (const path of [`/order/${order.id}`, '/user/orders', '/place-order', '/admin']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/sign-in/);
  }
});

test("E2E-05: a customer can't reach the admin area or another customer's order", async ({ page }) => {
  const someoneElses = await insertOrder(seeded.admin.id, seeded.products.lamp);
  const theirOwn = await insertOrder(seeded.customer.id, seeded.products.laptop);
  await signIn(page, seeded.customer.email);

  await page.goto('/admin/orders');
  await expect(page).toHaveURL(/\/$/);

  await page.goto(`/order/${someoneElses.id}`);
  await expect(page.getByText('Could not find requested resource')).toBeVisible();

  await page.goto(`/order/${theirOwn.id}`);
  await expect(page.getByText(seeded.products.laptop.name).first()).toBeVisible();
});

test('SHR-02: a shared cart link shows the items but not the guest session id', async ({ page, context, request }) => {
  await addToCart(page, seeded.products.lamp.slug);
  const sessionCartId = (await context.cookies()).find((c) => c.name === 'sessionCartId')!.value;
  const [cart] = await sql<{ id: string }>(`SELECT id FROM "Cart" WHERE "sessionCartId" = $1`, [sessionCartId]);

  // Fetched by someone else: no cookies of the owner
  const response = await request.get(`/share/cart/${cart.id}`, { headers: { cookie: '' } });
  const html = await response.text();

  expect(response.status()).toBe(200);
  expect(html).toContain(seeded.products.lamp.name);
  expect(html).not.toContain(sessionCartId);
});

test('the guest cookie cannot be read by page scripts', async ({ page, context }) => {
  await page.goto('/');
  const cookie = (await context.cookies()).find((c) => c.name === 'sessionCartId');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  expect(await page.evaluate(() => document.cookie)).not.toContain('sessionCartId');
});
