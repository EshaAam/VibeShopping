import Pagination from '@/components/shared/pagination';
import ProductCard from '@/components/shared/product/product-card';
import { Button } from '@/components/ui/button';
import {
  getAllCategories,
  getAllProducts,
  getPriceRange,
} from '@/lib/actions/product.actions';
import Link from 'next/link';
import PriceRangeSlider from '@/components/shared/price-range-slider';
import { getMyWishlist } from '@/lib/actions/wishlist.actions';
import { convertToPlainObject } from '@/lib/utils';
import SortDropdown from './sort-dropdown';

export async function generateMetadata(props: {
  searchParams: Promise<{
    q: string;
    category: string;
    price: string;
  }>;
}) {
  const {
    q = 'all',
    category = 'all',
    price = 'all',
  } = await props.searchParams;

  const isQuerySet = q && q !== 'all' && q.trim() !== '';
  const isCategorySet = category && category !== 'all' && category.trim() !== '';
  const isPriceSet = price && price !== 'all' && price.trim() !== '';

  if (isQuerySet || isCategorySet || isPriceSet) {
    return {
      title: `Search ${isQuerySet ? q : ''}${isCategorySet ? ` : Category ${category}` : ''}${isPriceSet ? ` : Price $${price}` : ''}`,
    };
  } else {
    return {
      title: 'Search Products',
    };
  }
}

const SearchPage = async (props: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    price?: string;
    sort?: string;
    page?: string;
  }>;
}) => {
  const {
    q = 'all',
    category = 'all',
    price = 'all',
    sort = 'newest',
    page = '1',
  } = await props.searchParams;

  // Get categories
  const categories = await getAllCategories();

  // Get price range
  const priceRange = await getPriceRange();

  // Get wishlist for product cards
  const wishlist = await getMyWishlist();

  // Parse current price filter
  let currentMinPrice: number | undefined;
  let currentMaxPrice: number | undefined;
  if (price !== 'all' && price.includes('-')) {
    const [minStr, maxStr] = price.split('-');
    currentMinPrice = Number(minStr);
    currentMaxPrice = Number(maxStr);
  }

  // Get products
  const productsResult = await getAllProducts({
    category,
    query: q,
    price,
    rating: 'all',
    page: Number(page),
    sort,
  });

  // Convert products to plain objects for client component
  const products = {
    data: convertToPlainObject(productsResult.data),
    totalPages: productsResult.totalPages,
  };

  // Construct filter url
  const getFilterUrl = ({
    c,
    s,
    p,
    pg,
  }: {
    c?: string;
    s?: string;
    p?: string;
    pg?: string;
  }) => {
    const params = { q, category, price, sort, page };
    if (c) params.category = c;
    if (p) params.price = p;
    if (pg) params.page = pg;
    if (s) params.sort = s;
    return `/search?${new URLSearchParams(params).toString()}`;
  };

  return (
    <div className='grid md:grid-cols-5 md:gap-5'>
      <div className='filter-links'>
        {/* Category Links */}
        <div className='text-xl mt-3 mb-2'>Category</div>
        <div>
          <ul className='space-y-1'>
            <li>
              <Link
                className={`${
                  ('all' === category || '' === category) && 'font-bold'
                }`}
                href={getFilterUrl({ c: 'all' })}
              >
                All
              </Link>
            </li>
            {categories.map((x) => (
              <li key={x.category}>
                <Link
                  className={`${x.category === category && 'font-bold'}`}
                  href={getFilterUrl({ c: x.category })}
                >
                  {x.category}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Price Range Slider */}
        <div className='mt-8'>
          <PriceRangeSlider
            minPrice={priceRange.minPrice}
            maxPrice={priceRange.maxPrice}
            currentMin={currentMinPrice}
            currentMax={currentMaxPrice}
          />
        </div>
      </div>

      <div className='md:col-span-4 space-y-4'>
        <div className='flex-between flex-col md:flex-row my-4'>
          <div className='flex items-center flex-wrap gap-1'>
            {q !== 'all' && q !== '' && (
              <span className='bg-muted px-2 py-1 rounded text-sm'>Query: {q}</span>
            )}
            {category !== 'all' && category !== '' && (
              <span className='bg-muted px-2 py-1 rounded text-sm'>Category: {category}</span>
            )}
            {price !== 'all' && (
              <span className='bg-muted px-2 py-1 rounded text-sm'>Price: ${price.replace('-', ' - $')}</span>
            )}
            {((q !== 'all' && q !== '') ||
              (category !== 'all' && category !== '') ||
              price !== 'all') && (
              <Button variant={'link'} asChild size='sm'>
                <Link href='/search'>Clear All</Link>
              </Button>
            )}
          </div>
          <SortDropdown currentSort={sort} />
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'>
          {products!.data.length === 0 && <div>No product found</div>}
          {products!.data.map((product) => (
            <ProductCard key={product.id} product={product} wishlist={wishlist} />
          ))}
        </div>
        {products!.totalPages! > 1 && (
          <Pagination page={page} totalPages={products!.totalPages} />
        )}
      </div>
    </div>
  );
};

export default SearchPage;
