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
import { updateOrderToPaidByCOD } from '@/lib/actions/order.actions';
import { useTransition } from 'react';
import { Package } from 'lucide-react';
import { InvoiceDialog } from '@/components/shared/invoice';
import { OrderStatusTimeline } from '@/components/shared/order/order-status-timeline';
import { UpdateOrderStatusDialog } from '@/components/shared/order/update-order-status-dialog';

const AdminOrderDetailsTable = ({
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

  // Button To mark the order as paid (COD)
  const MarkAsPaidButton = () => {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    return (
      <Button
        type='button'
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await updateOrderToPaidByCOD(order.id);
            toast({
              variant: res.success ? 'default' : 'destructive',
              description: res.message,
            });
          })
        }
      >
        {isPending ? 'processing...' : 'Mark As Paid'}
      </Button>
    );
  };

  return (
    <>
      <div className='flex items-center gap-4 py-4'>
        <Link href='/admin/orders' className='text-muted-foreground hover:text-foreground'>
          ← Back to Orders
        </Link>
      </div>
      <h1 className='py-4 text-2xl'> Order {formatId(order.id)}</h1>
      
      {/* Order Tracking Timeline - Admin View */}
      <Card className='mb-6'>
        <CardContent className='p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-xl font-semibold flex items-center gap-2'>
              <Package className='h-5 w-5' />
              Order Tracking
            </h2>
            <div className='flex items-center gap-2'>
              {/* Update Status Button - Admin only */}
              <UpdateOrderStatusDialog orderId={order.id} currentStatus={currentStatus} />
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

              {/* Cash On Delivery - Mark as Paid */}
              {!isPaid && paymentMethod === 'CashOnDelivery' && (
                <MarkAsPaidButton />
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

export default AdminOrderDetailsTable;
