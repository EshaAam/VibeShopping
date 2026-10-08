import { getMyWishlist } from '@/lib/data/wishlist';
import WishlistTable from './wishlist-table';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wishlist',
};

const WishlistPage = async () => {
  const wishlist = await getMyWishlist();

  return (
    <>
      <WishlistTable wishlist={wishlist} />
    </>
  );
};

export default WishlistPage;
