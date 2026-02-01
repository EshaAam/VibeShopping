'use client';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Filter } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PriceRangeSlider from '@/components/shared/price-range-slider';

interface MobileFiltersProps {
  categories: { category: string; _count: number }[];
  currentCategory: string;
  priceRange: { minPrice: number; maxPrice: number };
  currentMinPrice?: number;
  currentMaxPrice?: number;
}

const MobileFilters = ({ 
  categories, 
  currentCategory,
  priceRange,
  currentMinPrice,
  currentMaxPrice,
}: MobileFiltersProps) => {
  const searchParams = useSearchParams();

  const getFilterUrl = (category: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (category === 'all') {
      params.delete('category');
    } else {
      params.set('category', category);
    }
    params.set('page', '1');
    return `/search?${params.toString()}`;
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span>Filters</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[320px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">Filters</SheetTitle>
        </SheetHeader>
        
        {/* Price Range Filter */}
        <div className="mt-6 pb-6 border-b">
          <PriceRangeSlider
            minPrice={priceRange.minPrice}
            maxPrice={priceRange.maxPrice}
            currentMin={currentMinPrice}
            currentMax={currentMaxPrice}
          />
        </div>
        
        {/* Category Filter */}
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Category</h3>
          <ul className="space-y-2">
            <li>
              <Link
                className={`block py-2 px-3 rounded-md text-sm transition-colors hover:bg-muted ${
                  currentCategory === 'all' || !currentCategory
                    ? 'bg-primary text-primary-foreground'
                    : ''
                }`}
                href={getFilterUrl('all')}
              >
                All Categories
              </Link>
            </li>
            {categories.map((x) => (
              <li key={x.category}>
                <Link
                  className={`block py-2 px-3 rounded-md text-sm transition-colors hover:bg-muted ${
                    x.category === currentCategory
                      ? 'bg-primary text-primary-foreground'
                      : ''
                  }`}
                  href={getFilterUrl(x.category)}
                >
                  {x.category}
                  <span className="text-muted-foreground ml-2">({x._count})</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileFilters;
