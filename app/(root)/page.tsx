import ProductList from "@/components/shared/product/product-list";
import {
  getFeaturedProducts,
  getLatestProducts,
} from "@/lib/actions/product.actions";
import { ProductCarousel } from "@/components/shared/product/product-carousel";

const Homepage = async () => {
  const latestProducts = await getLatestProducts();
  const featuredProducts = await getFeaturedProducts();
  
  console.log('Featured Products:', featuredProducts);
  console.log('Featured Products Count:', featuredProducts.length);
  featuredProducts.forEach(p => {
    console.log(`Product: ${p.name}, isFeatured: ${p.isFeatured}, banner: ${p.banner}`);
  });
  
  return (
    <div>
      {featuredProducts.length > 0 && <ProductCarousel data={featuredProducts} />}

      <ProductList title='Newest Arrivals' data={latestProducts} />
    </div>
  );
};

export default Homepage;
