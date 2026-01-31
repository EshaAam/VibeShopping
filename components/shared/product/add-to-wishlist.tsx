'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  addItemToWishlist,
  removeItemFromWishlist,
} from '@/lib/actions/wishlist.actions';
import { Wishlist, WishlistItem } from '@/types';
import { Heart, Loader } from 'lucide-react';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

const AddToWishlist = ({
  wishlist,
  item,
}: {
  wishlist?: Wishlist;
  item: WishlistItem;
}) => {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleAddToWishlist = async () => {
    startTransition(async () => {
      const res = await addItemToWishlist(item);

      if (!res.success) {
        toast({
          variant: 'destructive',
          description: res.message,
        });
        return;
      }

      toast({
        description: `${item.name} added to wishlist`,
      });
    });
  };

  const handleRemoveFromWishlist = async () => {
    startTransition(async () => {
      const res = await removeItemFromWishlist(item.productId);

      toast({
        variant: res.success ? 'default' : 'destructive',
        description: res.message,
      });
    });
  };

  const existItem =
    wishlist && wishlist.items.find((x) => x.productId === item.productId);

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      disabled={isPending}
      onClick={existItem ? handleRemoveFromWishlist : handleAddToWishlist}
      className='relative h-8 w-8 sm:h-9 sm:w-9 hover:bg-accent/80 transition-colors'
    >
      {isPending ? (
        <Loader className='w-4 h-4 sm:w-5 sm:h-5 animate-spin' />
      ) : (
        <Heart
          className={cn(
            'w-4 h-4 sm:w-5 sm:h-5 transition-colors',
            existItem ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'
          )}
        />
      )}
    </Button>
  );
};

export default AddToWishlist;
