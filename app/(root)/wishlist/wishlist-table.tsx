'use client';

import { useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { removeItemFromWishlist } from '@/lib/actions/wishlist.actions';
import { addItemToCart } from '@/lib/actions/cart.actions';
import { Loader, ShoppingCart, Trash2 } from 'lucide-react';
import { Wishlist } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const WishlistTable = ({ wishlist }: { wishlist?: Wishlist }) => {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  if (!wishlist) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold">Your wishlist is empty</h2>
        <p className="text-muted-foreground">
          Add items to your wishlist to see them here.
        </p>
        <Button asChild className="mt-4">
          <Link href="/">Continue Shopping</Link>
        </Button>
      </div>
    );
  }

  const handleRemove = (productId: string) => {
    startTransition(async () => {
      const res = await removeItemFromWishlist(productId);
      if (!res.success) {
        toast({
          variant: 'destructive',
          description: res.message,
        });
      } else {
        toast({
          description: res.message,
        });
      }
    });
  };

  const handleAddToCart = (item: {
    productId: string;
    name: string;
    slug: string;
    price: string;
    image: string;
  }) => {
    startTransition(async () => {
      const res = await addItemToCart({
        ...item,
        qty: 1,
      });
      if (!res.success) {
        toast({
          variant: 'destructive',
          description: res.message,
        });
      } else {
        toast({
          description: `${item.name} added to cart`,
        });
      }
    });
  };

  return (
    <>
      <h1 className='py-4 h2-bold'>My Wishlist</h1>
      {!wishlist || wishlist.items.length === 0 ? (
        <div>
          Wishlist is empty.{' '}
          <Link href='/' className='text-primary underline'>
            Go shopping
          </Link>
        </div>
      ) : (
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className='text-right'>Price</TableHead>
                <TableHead className='text-center'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wishlist.items.map((item) => (
                <TableRow key={item.slug}>
                  <TableCell>
                    <Link
                      href={`/product/${item.slug}`}
                      className='flex items-center'
                    >
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={50}
                        height={50}
                      />
                      <span className='px-2'>{item.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className='text-right'>${item.price}</TableCell>
                  <TableCell className='text-center'>
                    <div className='flex items-center justify-center gap-2'>
                      <Button
                        disabled={isPending}
                        variant='default'
                        size='sm'
                        onClick={() => handleAddToCart(item)}
                      >
                        {isPending ? (
                          <Loader className='w-4 h-4 animate-spin' />
                        ) : (
                          <ShoppingCart className='w-4 h-4' />
                        )}
                      </Button>
                      <Button
                        disabled={isPending}
                        variant='destructive'
                        size='sm'
                        onClick={() => handleRemove(item.productId)}
                      >
                        {isPending ? (
                          <Loader className='w-4 h-4 animate-spin' />
                        ) : (
                          <Trash2 className='w-4 h-4' />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
};

export default WishlistTable;
