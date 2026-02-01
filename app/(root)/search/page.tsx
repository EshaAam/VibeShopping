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
import MobileFilters from './mobile-filters';

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
    <div className='grid lg:grid-cols-5 gap-4 lg:gap-5'>
      {/* Mobile Filter Button */}
      <div className='lg:hidden flex items-center justify-between mb-2'>
        <MobileFilters 
          categories={categories} 
          currentCategory={category}
          priceRange={priceRange}
          currentMinPrice={currentMinPrice}
          currentMaxPrice={currentMaxPrice}
        />
        <SortDropdown currentSort={sort} />
      </div>
      
      {/* Desktop Filter Sidebar */}
      <div className='hidden lg:block filter-links'>
        {/* Category Links */}
        <div className='text-lg lg:text-xl mt-3 mb-2 font-semibold'>Category</div>
        <div>
          <ul className='space-y-1'>
            <li>
              <Link
                className={`text-sm hover:underline ${
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
                  className={`text-sm hover:underline ${x.category === category && 'font-bold'}`}
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

      <div className='lg:col-span-4 space-y-4'>
        <div className='hidden lg:flex flex-col sm:flex-row gap-3 justify-between my-4'>
          <div className='flex items-center flex-wrap gap-1.5'>
            {q !== 'all' && q !== '' && (
              <span className='bg-muted px-2 py-1 rounded text-xs sm:text-sm'>Query: {q}</span>
            )}
            {category !== 'all' && category !== '' && (
              <span className='bg-muted px-2 py-1 rounded text-xs sm:text-sm'>Category: {category}</span>
            )}
            {price !== 'all' && (
              <span className='bg-muted px-2 py-1 rounded text-xs sm:text-sm'>Price: ${price.replace('-', ' - $')}</span>
            )}
            {((q !== 'all' && q !== '') ||
              (category !== 'all' && category !== '') ||
              price !== 'all') && (
              <Button variant={'link'} asChild size='sm' className='text-xs sm:text-sm'>
                <Link href='/search'>Clear All</Link>
              </Button>
            )}
          </div>
          <SortDropdown currentSort={sort} />
        </div>
        
        {/* Mobile Active Filters */}
        <div className='lg:hidden flex items-center flex-wrap gap-1.5'>
          {q !== 'all' && q !== '' && (
            <span className='bg-muted px-2 py-1 rounded text-xs'>Query: {q}</span>
          )}
          {category !== 'all' && category !== '' && (
            <span className='bg-muted px-2 py-1 rounded text-xs'>Category: {category}</span>
          )}
          {price !== 'all' && (
            <span className='bg-muted px-2 py-1 rounded text-xs'>Price: ${price.replace('-', ' - $')}</span>
          )}
          {((q !== 'all' && q !== '') ||
            (category !== 'all' && category !== '') ||
            price !== 'all') && (
            <Button variant={'link'} asChild size='sm' className='text-xs h-6 px-1'>
              <Link href='/search'>Clear</Link>
            </Button>
          )}
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3'>
          {products!.data.length === 0 && <div className='col-span-full text-center py-10 text-muted-foreground'>No product found</div>}
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
