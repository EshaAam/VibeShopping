/**
 * Admin catalog actions. A product that has been sold is archived, not
 * deleted, so past orders, invoices and reviews keep pointing at a real row;
 * and nothing reaches the catalog without passing validation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  productFindFirst: vi.fn(),
  productCreate: vi.fn(),
  productUpdate: vi.fn(),
  productDelete: vi.fn(),
  orderItemFindFirst: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: 'admin-1', role: 'admin' } }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/db/prisma', () => ({
  prisma: {
    user: { findUnique: async () => ({ role: 'admin' }) },
    product: {
      findFirst: h.productFindFirst,
      create: h.productCreate,
      update: h.productUpdate,
      delete: h.productDelete,
    },
    orderItem: { findFirst: h.orderItemFindFirst },
  },
}));

import { createProduct, deleteProduct, updateProduct } from '@/lib/actions/product.actions';

const lamp = {
  name: 'Brass Lamp',
  slug: 'brass-lamp',
  category: 'Lighting',
  brand: 'Lumen',
  description: 'A warm brass desk lamp',
  stock: 5,
  images: ['/lamp.jpg'],
  isFeatured: true,
  banner: null,
  price: '40.00',
};

beforeEach(() => {
  vi.clearAllMocks();
  h.productFindFirst.mockResolvedValue({ id: 'p1', archivedAt: null });
  h.orderItemFindFirst.mockResolvedValue(null);
});

describe('deleteProduct', () => {
  it('CAT-01: a product nobody has bought is deleted outright', async () => {
    expect(await deleteProduct('p1')).toEqual({
      success: true,
      message: 'Product deleted successfully',
    });
    expect(h.productDelete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(h.productUpdate).not.toHaveBeenCalled();
  });

  it('CAT-02: a product that has been sold is archived and unfeatured instead', async () => {
    h.orderItemFindFirst.mockResolvedValue({ orderId: 'order-1', productId: 'p1' });

    const res = await deleteProduct('p1');

    expect(res.message).toMatch(/archived/);
    expect(h.productDelete).not.toHaveBeenCalled();
    expect(h.productUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { archivedAt: expect.any(Date), isFeatured: false },
    });
  });

  it('refuses to archive twice, or a product that does not exist', async () => {
    h.productFindFirst.mockResolvedValueOnce({ id: 'p1', archivedAt: new Date() });
    expect(await deleteProduct('p1')).toEqual({
      success: false,
      message: 'Product is already archived',
    });

    h.productFindFirst.mockResolvedValueOnce(null);
    expect(await deleteProduct('p1')).toEqual({ success: false, message: 'Product not found' });
    expect(h.productUpdate).not.toHaveBeenCalled();
  });
});

describe('createProduct / updateProduct', () => {
  it('saves a valid product', async () => {
    expect((await createProduct(lamp)).success).toBe(true);
    expect(h.productCreate).toHaveBeenCalledWith({ data: lamp });
  });

  it.each([
    ['a price with three decimals', { price: '10.999' }],
    ['negative stock', { stock: -1 }],
    ['fractional stock', { stock: 1.5 }],
    ['no images', { images: [] }],
    ['a two-letter name', { name: 'ab' }],
  ])('CAT-04: refuses %s', async (_, change) => {
    const res = await createProduct({ ...lamp, ...change });
    expect(res.success).toBe(false);
    expect(h.productCreate).not.toHaveBeenCalled();
  });

  it('CAT-04: an update goes through the same validation', async () => {
    const res = await updateProduct({ ...lamp, id: 'p1', stock: -3 });
    expect(res.success).toBe(false);
    expect(h.productUpdate).not.toHaveBeenCalled();
  });
});
