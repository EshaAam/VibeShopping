import { expect, type Page } from '@playwright/test';
import { PASSWORD } from './db';

export async function signIn(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

export async function addToCart(page: Page, slug: string) {
  await page.goto(`/product/${slug}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  // The button turns into quantity controls once the server has saved it
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeHidden();
}

/** Cart → saved address → chosen payment method → order page. Returns the order id. */
export async function checkout(page: Page, paymentMethod: 'Stripe' | 'CashOnDelivery') {
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await expect(page).toHaveURL(/\/shipping-address/);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/payment-method/);
  await page.getByLabel(paymentMethod).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/place-order/);
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/\/order\/[0-9a-f-]{36}$/);
  return page.url().split('/').pop()!;
}

export async function fillShippingAddress(page: Page) {
  await page.getByPlaceholder('Enter full name').fill('Sam Newcomer');
  await page.getByPlaceholder('Enter address').fill('22 Lake Road');
  await page.getByPlaceholder('Enter city').fill('Chattogram');
  await page.getByPlaceholder('Enter country').fill('Bangladesh');
  await page.getByPlaceholder('Enter postal code').fill('4000');
}

/**
 * The Stripe iframe holding the card fields. Stripe mounts several iframes
 * with the same title (Link, the card form), so find it by what it contains.
 */
async function stripeCardFrame(page: Page) {
  for (let attempt = 0; attempt < 60; attempt++) {
    for (const frame of page.frames()) {
      if (await frame.locator('input[name="number"]').count().catch(() => 0)) return frame;
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Stripe card form did not load');
}

/** Fill Stripe's Payment Element (inside its iframe) with a test card. */
export async function payWithCard(page: Page, cardNumber: string) {
  const stripe = await stripeCardFrame(page);
  await stripe.locator('input[name="number"]').fill(cardNumber);
  await stripe.locator('input[name="expiry"]').fill('12 / 34');
  await stripe.locator('input[name="cvc"]').fill('123');
  const postal = stripe.locator('input[name="postalCode"]');
  if (await postal.isVisible().catch(() => false)) await postal.fill('10001');
  await page.getByRole('button', { name: /^Purchase/ }).click();
}
