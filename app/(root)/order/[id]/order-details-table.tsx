'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDateTime, formatId } from '@/lib/utils';
import { Order, OrderStatus } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { updateOrderToPaid } from '@/lib/actions/order.actions';
import { useTransition } from 'react';
import { CreditCard, Loader, Wallet, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { InvoiceDialog } from '@/components/shared/invoice';
import { OrderStatusTimeline } from '@/components/shared/order/order-status-timeline';
import { CancelOrderButton } from '@/components/shared/order/cancel-order-button';
import StripePaymentForm from '@/components/shared/payment/stripe-payment-form';

const OrderDetailsTable = ({
  order,
}: {
  order: Order;
}) => {
  const {
    shippingAddress,
    orderItems,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    paymentMethod,
    isPaid,
    paidAt,
    isDelivered,
    deliveredAt,
    orderStatus,
    trackingNumber,
  } = order;

  const currentStatus = (orderStatus || 'Pending') as OrderStatus;

  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handlePayment = async () => {
    startTransition(async () => {
      const res = await updateOrderToPaid(order.id);

      if (!res.success) {
        toast({
          variant: 'destructive',
          description: res.message,
        });
        return;
      }

      toast({
        description: `✅ Payment successful via ${paymentMethod}!`,
      });

      // Refresh the page to show updated payment status
      router.refresh();
    });
  };

  return (
    <>
      <h1 className='py-4 text-2xl'> Order {formatId(order.id)}</h1>
      
      {/* Order Tracking Timeline - User View (Read Only + Cancel) */}
      <Card className='mb-6'>
        <CardContent className='p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-xl font-semibold flex items-center gap-2'>
              <Package className='h-5 w-5' />
              Order Tracking
            </h2>
            <div className='flex items-center gap-2'>
              {/* Cancel Order Button - Only before payment */}
              {!isPaid && <CancelOrderButton orderId={order.id} currentStatus={currentStatus} />}
            </div>
          </div>
          
          {trackingNumber && (
            <div className='mb-4 p-3 bg-muted rounded-lg'>
              <span className='text-sm text-muted-foreground'>Tracking Number: </span>
              <span className='font-mono font-medium'>{trackingNumber}</span>
            </div>
          )}
          
          <OrderStatusTimeline currentStatus={currentStatus} />
        </CardContent>
      </Card>

      <div className='grid md:grid-cols-3 md:gap-5'>
        <div className='overflow-x-auto md:col-span-2 space-y-4'>
          <Card>
            <CardContent className='p-4 gap-4'>
              <h2 className='text-xl pb-4'>Payment Method</h2>
              <p>{paymentMethod}</p>
              {isPaid ? (
                <Badge variant='secondary'>
                  Paid at {formatDateTime(paidAt!).dateTime}
                </Badge>
              ) : (
                <Badge variant='destructive'>Not paid</Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-4 gap-4'>
              <h2 className='text-xl pb-4'>Shipping Address</h2>
              <p>{shippingAddress.fullName}</p>
              <p>
                {shippingAddress.streetAddress}, {shippingAddress.city},{' '}
                {shippingAddress.postalCode}, {shippingAddress.country}{' '}
              </p>
              {isDelivered ? (
                <Badge variant='secondary'>
                  Delivered at {formatDateTime(deliveredAt!).dateTime}
                </Badge>
              ) : (
                <Badge variant='destructive'>Not delivered</Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-4 gap-4'>
              <h2 className='text-xl pb-4'>Order Items</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item) => (
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
                          ></Image>
                          <span className='px-2'>{item.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className='px-2'>{item.qty}</span>
                      </TableCell>
                      <TableCell className='text-right'>${item.price}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent className='p-4 space-y-4 gap-4'>
              <h2 className='text-xl pb-4'>Order Summary</h2>
              <div className='flex justify-between'>
                <div>Items</div>
                <div>{formatCurrency(itemsPrice)}</div>
              </div>
              <div className='flex justify-between'>
                <div>Tax</div>
                <div>{formatCurrency(taxPrice)}</div>
              </div>
              <div className='flex justify-between'>
                <div>Shipping</div>
                <div>{formatCurrency(shippingPrice)}</div>
              </div>
              <div className='flex justify-between'>
                <div>Total</div>
                <div>{formatCurrency(totalPrice)}</div>
              </div>

              {!isPaid && (
                <div className='mt-4'>
                  {paymentMethod === 'Stripe' ? (
                    <StripePaymentForm
                      orderId={order.id}
                      totalPrice={Number(totalPrice)}
                      onPaymentSuccess={() => router.refresh()}
                    />
                  ) : (
                    <>
                      <Button
                        onClick={handlePayment}
                        disabled={isPending}
                        className='w-full'
                        size='lg'
                      >
                        {isPending ? (
                          <>
                            <Loader className='w-4 h-4 mr-2 animate-spin' />
                            Processing Payment...
                          </>
                        ) : (
                          <>
                            {paymentMethod === 'CashOnDelivery' && (
                              <Wallet className='w-4 h-4 mr-2' />
                            )}
                            {paymentMethod !== 'CashOnDelivery' && (
                              <CreditCard className='w-4 h-4 mr-2' />
                            )}
                            {paymentMethod === 'CashOnDelivery' ? 'Mark as Paid (COD)' : `Pay with ${paymentMethod}`}
                          </>
                        )}
                      </Button>
                      {paymentMethod === 'CashOnDelivery' && (
                        <p className='text-xs text-muted-foreground text-center mt-2'>
                          💵 Pay when your order arrives
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Download Invoice - Show after payment */}
              {isPaid && (
                <div className='mt-4 pt-4 border-t'>
                  <InvoiceDialog
                    order={order}
                    variant='default'
                    size='lg'
                    className='w-full'
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default OrderDetailsTable;