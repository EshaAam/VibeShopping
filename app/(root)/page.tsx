import ProductList from '@/components/shared/product/product-list';
import {
  getFeaturedProducts,
  getLatestProducts,
} from '@/lib/actions/product.actions';
import { ProductCarousel } from '@/components/shared/product/product-carousel';
import ViewAllProductsButton from '@/components/view-all-products-button';
import { getMyWishlist } from '@/lib/actions/wishlist.actions';
import { convertToPlainObject } from '@/lib/utils';

const Homepage = async () => {
  const latestProductsData = await getLatestProducts();
  const featuredProducts = await getFeaturedProducts();
  const wishlist = await getMyWishlist();

  // Convert to plain objects for client component
  const latestProducts = convertToPlainObject(latestProductsData);

  return (
    <div>
      {featuredProducts.length > 0 && <ProductCarousel data={featuredProducts} />}

      <ProductList title='Newest Arrivals' data={latestProducts} wishlist={wishlist} />
      <ViewAllProductsButton />
    </div>
  );
};

export default Homepage;
