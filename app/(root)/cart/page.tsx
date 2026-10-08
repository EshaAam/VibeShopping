import { getMyCart } from '@/lib/data/cart';
import CartTable from './cart-table';

export const metadata = {
  title: 'Shopping Cart',
};

const CartPage = async () => {
  const cart = await getMyCart();

  return (
    <>
      <CartTable cart={cart} cartId={cart?.id} />
    </>
  );
};

export default CartPage;