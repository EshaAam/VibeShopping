import {
  cartItemSchema,
  insertCartSchema,
  insertProductSchema,
  shippingAddressSchema,
  insertOrderItemSchema,
  insertOrderSchema,
  insertReviewSchema,
  wishlistItemSchema,
} from '@/lib/validator';
import {z} from 'zod';

export type Product = z.infer<typeof insertProductSchema> & {
  id: string;
  createdAt: Date;
  rating: string;
  numReviews: number;
};

export type Cart = z.infer<typeof insertCartSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export type OrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = z.infer<typeof insertOrderSchema> & {
  id: string;
  createdAt: Date;
  isPaid: boolean;
  paidAt: Date | null;
  isDelivered: boolean;
  deliveredAt: Date | null;
  orderItems: OrderItem[];
  user: { name: string; email: string };
};

export type Review = z.infer<typeof insertReviewSchema> & {
  id: string;
  createdAt: Date;
  user?: { name: string };
};

export type WishlistItem = z.infer<typeof wishlistItemSchema>;

export type Wishlist = {
  id: string;
  userId?: string | null;
  sessionWishlistId?: string | null;
  items: WishlistItem[];
  createdAt: Date;
  updatedAt: Date;
};
