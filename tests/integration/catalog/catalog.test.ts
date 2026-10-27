/**
 * Archived products and reviews against a real Postgres. An archived product
 * must disappear from every place a customer can find or buy it, while old
 * order links still resolve; reviews must stay one per customer, with the
 * product's rating recomputed from the rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', async () => ({ auth: (await import('../helpers/request')).auth }));

import { deleteProduct, getSearchSuggestions } from '@/lib/actions/product.actions';
import { checkIfUserPurchasedProduct, createUpdateReview } from '@/lib/actions/review.actions';
import { retrieveProducts } from '@/lib/ai/retrieval';
import {
  getAllCategories,
  getAllProducts,
  getFeaturedProducts,
  getLatestProducts,
  getProductBySlug,
} from '@/lib/data/product';
import { prisma, setupTestDatabase } from '../helpers/db';
import { makeProduct, makeUser } from '../helpers/factories';
import { as, signedIn } from '../helpers/request';

setupTestDatabase();

/** A paid (or cancelled) order of `product` by `user`, written directly. */
async function purchase(
  user: { id: string },
  product: { id: string; name: string; slug: string },
  { cancelled = false } = {}
) {
  return prisma.order.create({
    data: {
      userId: user.id,
      shippingAddress: { city: 'Dhaka' },
      paymentMethod: 'Stripe',
      itemsPrice: '40.00',
      shippingPrice: '10.00',
      taxPrice: '6.00',
      totalPrice: '56.00',
      isPaid: true,
      paidAt: new Date(),
      orderStatus: cancelled ? 'Cancelled' : 'Processing',
      orderItems: {
        create: { productId: product.id, qty: 1, price: '40.00', name: product.name, slug: product.slug, image: '/x.jpg' },
      },
    },
  });
}

describe('archived products', () => {
  let archived: Awaited<ReturnType<typeof makeProduct>>;

  beforeEach(async () => {
    const admin = await makeUser({ role: 'admin' });
    await makeProduct({ name: 'Brass Lamp', isFeatured: true, category: 'Lighting' });
    archived = await makeProduct({ name: 'Brass Lantern', isFeatured: true, category: 'Lanterns' });
    await purchase(await makeUser(), archived);

    const res = await as(signedIn({ id: admin.id, role: 'admin' }), () => deleteProduct(archived.id));
    expect(res.message).toMatch(/archived/);
  });

  const names = (rows: { name: string }[]) => rows.map((r) => r.name);

  it('CAT-03: vanish from home, search, featured, categories, suggestions and the AI', async () => {
    expect(names(await getLatestProducts())).toEqual(['Brass Lamp']);
    expect(names(await getFeaturedProducts())).toEqual(['Brass Lamp']);
    expect(names((await getAllProducts({ query: 'brass', category: 'all', page: 1 })).data)).toEqual([
      'Brass Lamp',
    ]);
    expect((await getAllCategories()).map((c) => c.category)).toEqual(['Lighting']);
    expect(names(await getSearchSuggestions('brass'))).toEqual(['Brass Lamp']);
    expect(names(await retrieveProducts('brass lamps and lanterns'))).toEqual(['Brass Lamp']);
  });

  it('CAT-02: stay reachable from old order links and the admin list', async () => {
    expect((await getProductBySlug(archived.slug))?.archivedAt).toBeInstanceOf(Date);
    const adminList = await getAllProducts({ query: 'brass', category: 'all', page: 1, includeArchived: true });
    expect(names(adminList.data).sort()).toEqual(['Brass Lamp', 'Brass Lantern']);
  });
});

describe('reviews', () => {
  it('REV-02: a second review replaces the first and the rating is recomputed from the rows', async () => {
    const [alice, bob] = [await makeUser({ name: 'Alice' }), await makeUser({ name: 'Bob' })];
    const lamp = await makeProduct();
    await purchase(alice, lamp);
    await purchase(bob, lamp);

    await as(signedIn(alice), () => createUpdateReview({ productId: lamp.id, userId: '', rating: 5, description: 'Lovely' }));
    await as(signedIn(bob), () => createUpdateReview({ productId: lamp.id, userId: '', rating: 2, description: 'Too dim' }));
    await as(signedIn(alice), () => createUpdateReview({ productId: lamp.id, userId: '', rating: 4, description: 'Still good' }));

    expect(await prisma.review.count({ where: { productId: lamp.id } })).toBe(2);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: lamp.id } });
    expect(product.numReviews).toBe(2);
    expect(product.rating).toBe('3'); // (4 + 2) / 2, via the price/rating string extension
  });

  it('REV-04: a purchase that was cancelled and refunded does not unlock reviews', async () => {
    const user = await makeUser();
    const lamp = await makeProduct();
    await purchase(user, lamp, { cancelled: true });

    expect(await as(signedIn(user), () => checkIfUserPurchasedProduct(lamp.id))).toBe(false);
    const res = await as(signedIn(user), () =>
      createUpdateReview({ productId: lamp.id, userId: '', rating: 5, description: 'Great' })
    );
    expect(res.message).toBe('You can only review products you have purchased');
  });
});
