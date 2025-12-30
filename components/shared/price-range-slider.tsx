'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

interface PriceRangeSliderProps {
  minPrice: number;
  maxPrice: number;
  currentMin?: number;
  currentMax?: number;
}

const PriceRangeSlider = ({
  minPrice,
  maxPrice,
  currentMin,
  currentMax,
}: PriceRangeSliderProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [min, setMin] = useState(currentMin ?? minPrice);
  const [max, setMax] = useState(currentMax ?? maxPrice);
  const [isDragging, setIsDragging] = useState(false);

  // Update state when props change
  useEffect(() => {
    setMin(currentMin ?? minPrice);
    setMax(currentMax ?? maxPrice);
  }, [currentMin, currentMax, minPrice, maxPrice]);

  const applyFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (min === minPrice && max === maxPrice) {
      params.set('price', 'all');
    } else {
      params.set('price', `${Math.round(min)}-${Math.round(max)}`);
    }
    params.set('page', '1'); // Reset to first page when filter changes
    
    router.push(`/search?${params.toString()}`);
  }, [min, max, minPrice, maxPrice, router, searchParams]);

  // Debounce apply filter when slider stops
  useEffect(() => {
    if (isDragging) return;
    
    const timer = setTimeout(() => {
      applyFilter();
    }, 500);

    return () => clearTimeout(timer);
  }, [min, max, isDragging, applyFilter]);

  const handleMinChange = (value: number) => {
    const newMin = Math.min(value, max - 1);
    setMin(Math.max(minPrice, newMin));
  };

  const handleMaxChange = (value: number) => {
    const newMax = Math.max(value, min + 1);
    setMax(Math.min(maxPrice, newMax));
  };

  const getLeftPosition = () => {
    return ((min - minPrice) / (maxPrice - minPrice)) * 100;
  };

  const getRightPosition = () => {
    return ((max - minPrice) / (maxPrice - minPrice)) * 100;
  };

  const handleReset = () => {
    setMin(minPrice);
    setMax(maxPrice);
  };

  const isFiltered = min !== minPrice || max !== maxPrice;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium">Price Range</h3>
        {isFiltered && (
          <button
            onClick={handleReset}
            className="text-xs text-primary hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Dual Range Slider */}
      <div className="relative h-6 mt-6">
        {/* Track Background */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200 rounded-full" />
        
        {/* Active Track */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-orange-500 rounded-full"
          style={{
            left: `${getLeftPosition()}%`,
            right: `${100 - getRightPosition()}%`,
          }}
        />

        {/* Min Thumb */}
        <input
          type="range"
          min={minPrice}
          max={maxPrice}
          value={min}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-4
            [&::-webkit-slider-thumb]:border-orange-500
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md
            [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-4
            [&::-moz-range-thumb]:border-orange-500
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:shadow-md"
        />

        {/* Max Thumb */}
        <input
          type="range"
          min={minPrice}
          max={maxPrice}
          value={max}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-4
            [&::-webkit-slider-thumb]:border-orange-500
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md
            [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-4
            [&::-moz-range-thumb]:border-orange-500
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:shadow-md"
        />
      </div>

      {/* Input Fields */}
      <div className="flex items-center gap-3 mt-4">
        <div className="flex-1">
          <Input
            type="number"
            value={Math.round(min)}
            onChange={(e) => handleMinChange(Number(e.target.value))}
            onBlur={applyFilter}
            min={minPrice}
            max={max - 1}
            className="text-center text-sm"
          />
        </div>
        <span className="text-muted-foreground">-</span>
        <div className="flex-1">
          <Input
            type="number"
            value={Math.round(max)}
            onChange={(e) => handleMaxChange(Number(e.target.value))}
            onBlur={applyFilter}
            min={min + 1}
            max={maxPrice}
            className="text-center text-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default PriceRangeSlider;
