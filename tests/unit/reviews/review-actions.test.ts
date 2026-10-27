/**
 * Reviews are "verified purchase" only: the reviewer must have a paid order
 * containing the product, and an order that was cancelled (and refunded) no
 * longer counts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const tx = {
    review: { create: vi.fn(), update: vi.fn(), aggregate: vi.fn(), count: vi.fn() },
    product: { update: vi.fn() },
  };
  return {
    tx,
    auth: vi.fn(),
    orderItemFindFirst: vi.fn(),
    productFindFirst: vi.fn(),
    reviewFindFirst: vi.fn(),
  };
});

vi.mock('@/auth', () => ({ auth: h.auth }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/db/prisma', () => ({
  prisma: {
    orderItem: { findFirst: h.orderItemFindFirst },
    product: { findFirst: h.productFindFirst },
    review: { findFirst: h.reviewFindFirst },
    $transaction: (fn: (tx: unknown) => unknown) => fn(h.tx),
  },
}));

import { checkIfUserPurchasedProduct, createUpdateReview } from '@/lib/actions/review.actions';

const review = { productId: 'p1', userId: 'ignored', rating: 4, description: 'Bright and sturdy' };

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ user: { id: 'user-1', name: 'Alice' } });
  h.productFindFirst.mockResolvedValue({ id: 'p1', slug: 'lamp' });
  h.orderItemFindFirst.mockResolvedValue({ orderId: 'order-1' });
  h.reviewFindFirst.mockResolvedValue(null);
  h.tx.review.aggregate.mockResolvedValue({ _avg: { rating: 4 } });
  h.tx.review.count.mockResolvedValue(1);
});

describe('checkIfUserPurchasedProduct', () => {
  it('looks for a paid order of this product by this customer', async () => {
    expect(await checkIfUserPurchasedProduct('p1')).toBe(true);
    expect(h.orderItemFindFirst.mock.calls[0][0].where).toMatchObject({
      productId: 'p1',
      order: { userId: 'user-1', isPaid: true },
    });
  });

  // Regression: a paid order that was later cancelled (and refunded) used to
  // keep granting the verified-purchase review.
  it('REV-04: a cancelled order no longer counts as a purchase', async () => {
    await checkIfUserPurchasedProduct('p1');
    expect(h.orderItemFindFirst.mock.calls[0][0].where.order).toMatchObject({
      orderStatus: { not: 'Cancelled' },
    });
  });

  it('a signed-out visitor has bought nothing', async () => {
    h.auth.mockResolvedValue(null);
    expect(await checkIfUserPurchasedProduct('p1')).toBe(false);
    expect(h.orderItemFindFirst).not.toHaveBeenCalled();
  });
});

describe('createUpdateReview', () => {
  it('REV-01: refuses a customer who has not bought the product', async () => {
    h.orderItemFindFirst.mockResolvedValue(null);

    expect(await createUpdateReview(review)).toEqual({
      success: false,
      message: 'You can only review products you have purchased',
    });
    expect(h.tx.review.create).not.toHaveBeenCalled();
  });

  it.each([0, 6, 3.5])('REV-03: refuses a rating of %s', async (rating) => {
    const res = await createUpdateReview({ ...review, rating });
    expect(res.success).toBe(false);
    expect(h.tx.review.create).not.toHaveBeenCalled();
  });

  it('writes the review as the signed-in user, whatever userId the client sent', async () => {
    await createUpdateReview({ ...review, userId: 'someone-else' });

    expect(h.tx.review.create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      productId: 'p1',
      rating: 4,
      title: 'Alice',
      isVerifiedPurchase: true,
    });
  });

  it("a second review updates the first and recomputes the product's rating", async () => {
    h.reviewFindFirst.mockResolvedValue({ id: 'review-1' });
    h.tx.review.aggregate.mockResolvedValue({ _avg: { rating: 3.5 } });
    h.tx.review.count.mockResolvedValue(2);

    await createUpdateReview({ ...review, rating: 3 });

    expect(h.tx.review.create).not.toHaveBeenCalled();
    expect(h.tx.review.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'review-1' },
      data: { rating: 3 },
    });
    expect(h.tx.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { rating: 3.5, numReviews: 2 },
    });
  });
});
