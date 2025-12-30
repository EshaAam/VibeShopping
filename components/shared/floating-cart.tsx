'use client';

import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FloatingCartProps {
  cartItemsCount: number;
}

const FloatingCart = ({ cartItemsCount }: FloatingCartProps) => {
  return (
    <Link href="/cart">
      <Button
        className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        size="icon"
        aria-label="View cart"
      >
        <ShoppingCart className="h-5 w-5" />
        {cartItemsCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs font-bold">
            {cartItemsCount > 99 ? '99+' : cartItemsCount}
          </Badge>
        )}
      </Button>
    </Link>
  );
};

export default FloatingCart;
