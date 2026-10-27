/**
 * Life after checkout: an admin takes a cash-on-delivery order all the way to
 * Delivered while the customer watches the timeline, and a customer's cancel
 * puts the stock back on the shelf.
 */
import { expect, test } from '@playwright/test';
import { resetDatabase, stockOf, type Seeded } from './support/db';
import { addToCart, checkout, signIn } from './support/pages';

let seeded: Seeded;
test.beforeEach(async () => {
  seeded = await resetDatabase();
});

test('E2E-03: cash on delivery from order to doorstep', async ({ page, browser }) => {
  await signIn(page, seeded.customer.email);
  await addToCart(page, seeded.products.lamp.slug);
  const orderId = await checkout(page, 'CashOnDelivery');
  await expect(page.getByText('Not paid')).toBeVisible();

  // The admin, in a separate browser session
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signIn(admin, seeded.admin.email);
  await admin.goto(`/admin/orders/${orderId}`);

  await admin.getByRole('button', { name: 'Mark As Paid' }).click();
  await expect(admin.getByText(/^Paid at/)).toBeVisible();

  async function moveTo(status: 'Shipped' | 'Delivered', tracking?: string) {
    await admin.getByRole('button', { name: 'Update Status' }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByRole('combobox').click();
    await admin.getByRole('option', { name: status }).click();
    if (tracking) await dialog.getByPlaceholder('Enter tracking number').fill(tracking);
    await dialog.getByRole('button', { name: 'Update Status' }).click();
    await expect(dialog).toBeHidden();
  }
  await moveTo('Shipped', 'TRK-E2E-1');
  await moveTo('Delivered');
  await adminContext.close();

  // The customer sees it delivered, with the tracking number
  await page.reload();
  await expect(page.getByText(/^Delivered at/)).toBeVisible();
  await expect(page.getByText('TRK-E2E-1').first()).toBeVisible();
});

test('E2E-04: cancelling an unpaid order puts the stock back', async ({ page }) => {
  const lantern = seeded.products.lantern; // stock 1
  await signIn(page, seeded.customer.email);
  await addToCart(page, lantern.slug);
  const orderId = await checkout(page, 'CashOnDelivery');

  await page.goto(`/product/${lantern.slug}`);
  await expect(page.getByText('Out of stock!')).toBeVisible();

  await page.goto(`/order/${orderId}`);
  await page.getByRole('button', { name: 'Cancel Order' }).click();
  await page.getByRole('button', { name: 'Yes, Cancel Order' }).click();
  await expect(page.getByRole('button', { name: 'Cancel Order' })).toBeHidden();

  await page.goto(`/product/${lantern.slug}`);
  await expect(page.getByText('In stock')).toBeVisible();
  expect(await stockOf(lantern.id)).toBe(1);
});

test('CAT-02: an archived product is gone from the store but still opens from an old order', async ({ page, browser }) => {
  await signIn(page, seeded.customer.email);
  await addToCart(page, seeded.products.lamp.slug);
  const orderId = await checkout(page, 'CashOnDelivery');

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signIn(admin, seeded.admin.email);
  await admin.goto('/admin/products');
  const row = admin.getByRole('row').filter({ hasText: seeded.products.lamp.name });
  await row.getByRole('button', { name: 'Delete' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(admin.getByRole('alertdialog')).toBeHidden();
  await adminContext.close();

  await page.goto('/search?q=E2E');
  await expect(page.getByText(seeded.products.laptop.name).first()).toBeVisible();
  await expect(page.getByText(seeded.products.lamp.name)).toHaveCount(0);

  await page.goto(`/order/${orderId}`);
  await page.getByRole('link', { name: seeded.products.lamp.name }).click();
  await expect(page.getByText('No longer available')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(0);
});
