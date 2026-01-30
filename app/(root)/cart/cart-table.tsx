'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { addItemToCart, removeItemFromCart } from '@/lib/actions/cart.actions';
import { ArrowRight, Loader, Minus, Plus } from 'lucide-react';
import { Cart } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { ShareButton } from '@/components/shared/share-button';

const CartTable = ({ cart, cartId }: { cart?: Cart; cartId?: string }) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-4">
        <h1 className='h2-bold'>Shopping Cart</h1>
        {cart && cart.items.length > 0 && cartId && (
          <ShareButton 
            type="cart" 
            shareId={cartId} 
            itemCount={cart.items.length} 
          />
        )}
      </div>
      {!cart || cart.items.length === 0 ? (
        <div className='text-center py-10'>
          <p className='text-muted-foreground mb-4'>Cart is empty.</p>
          <Link href='/' className='text-primary hover:underline'>Go shopping</Link>
        </div>
      ) : (
        <div className='grid lg:grid-cols-4 gap-4 lg:gap-5'>
          <div className='overflow-x-auto lg:col-span-3'>
            {/* Mobile Cart View */}
            <div className='block md:hidden space-y-4'>
              {cart.items.map((item) => (
                <Card key={item.slug} className='p-3'>
                  <div className='flex gap-3'>
                    <Link href={`/product/${item.slug}`}>
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={80}
                        height={80}
                        className='object-cover rounded'
                      />
                    </Link>
                    <div className='flex-1 min-w-0'>
                      <Link href={`/product/${item.slug}`} className='font-medium text-sm line-clamp-2 hover:underline'>
                        {item.name}
                      </Link>
                      <p className='text-lg font-bold mt-1'>${item.price}</p>
                      <div className='flex items-center gap-2 mt-2'>
                        <Button
                          disabled={isPending}
                          variant='outline'
                          size='icon'
                          className='h-8 w-8'
                          onClick={() =>
                            startTransition(async () => {
                              const res = await removeItemFromCart(item.productId);
                              if (!res.success) {
                                toast({
                                  variant: 'destructive',
                                  description: res.message,
                                });
                              }
                            })
                          }
                        >
                          {isPending ? <Loader className='w-3 h-3 animate-spin' /> : <Minus className='w-3 h-3' />}
                        </Button>
                        <span className='w-8 text-center font-medium'>{item.qty}</span>
                        <Button
                          disabled={isPending}
                          variant='outline'
                          size='icon'
                          className='h-8 w-8'
                          onClick={() =>
                            startTransition(async () => {
                              const res = await addItemToCart(item);
                              if (!res.success) {
                                toast({
                                  variant: 'destructive',
                                  description: res.message,
                                });
                              }
                            })
                          }
                        >
                          {isPending ? <Loader className='w-3 h-3 animate-spin' /> : <Plus className='w-3 h-3' />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {/* Desktop Cart View */}
            <Table className='hidden md:table'>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className='text-center'>Quantity</TableHead>
                  <TableHead className='text-right'>Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.items.map((item) => (
                  <TableRow key={item.slug}>
                    <TableCell>
                      <Link href={`/product/${item.slug}`} className='flex items-center'>
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={50}
                          height={50}
                          className='object-cover rounded'
                          style={{ width: '50px', height: '50px' }}
                        />
                        <span className='px-2'>{item.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className='flex-center gap-2'>
                      <Button
                        disabled={isPending}
                        variant='outline'
                        type='button'
                        onClick={() =>
                          startTransition(async () => {
                            const res = await removeItemFromCart(item.productId);
                            if (!res.success) {
                              toast({
                                variant: 'destructive',
                                description: res.message,
                              });
                            }
                          })
                        }
                      >
                        {isPending ? (
                          <Loader className='w-4 h-4  animate-spin' />
                        ) : (
                          <Minus className='w-4 h-4' />
                        )}
                      </Button>
                      <span>{item.qty}</span>
                      <Button
                        disabled={isPending}
                        variant='outline'
                        type='button'
                        onClick={() =>
                          startTransition(async () => {
                            const res = await addItemToCart(item);
                            if (!res.success) {
                              toast({
                                variant: 'destructive',
                                description: res.message,
                              });
                            }
                          })
                        }
                      >
                        {isPending ? (
                          <Loader className='w-4 h-4  animate-spin' />
                        ) : (
                          <Plus className='w-4 h-4' />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className='text-right'>${item.price}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Card className='h-fit'>
            <CardContent className='p-4 space-y-4'>
              <div className='text-base sm:text-xl'>
                Subtotal ({cart.items.reduce((a, c) => a + c.qty, 0)}):
                <span className='font-bold'> {formatCurrency(cart.itemsPrice)}</span>
              </div>
              <button
                onClick={() => startTransition(() => router.push('/shipping-address'))}
                className='gradient-btn w-full py-3 px-4 flex items-center justify-center gap-2 text-sm sm:text-base'
                disabled={isPending}
              >
                {isPending ? (
                  <Loader className='animate-spin w-4 h-4' />
                ) : (
                  <ArrowRight className='w-4 h-4' />
                )}
                Proceed to Checkout
              </button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default CartTable;