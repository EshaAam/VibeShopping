import { getSharedCart } from '@/lib/actions/cart.actions';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShoppingCart, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CartItem } from '@/types';

export const metadata: Metadata = {
  title: 'Shared Cart',
};

const SharedCartPage = async (props: {
  params: Promise<{ id: string }>;
}) => {
  const params = await props.params;
  const { id } = params;

  const cart = await getSharedCart(id);
  
  if (!cart) {
    notFound();
  }

  const items = cart.items as CartItem[];

  return (
    <div className="wrapper py-10">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="text-center border-b">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Shared Cart</CardTitle>
          </div>
          <p className="text-muted-foreground">
            {cart.userName}&apos;s cart with {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {items.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">This cart is empty.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.slug}>
                        <TableCell>
                          <Link
                            href={`/product/${item.slug}`}
                            className="flex items-center gap-3 hover:text-primary transition-colors"
                          >
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={60}
                              height={60}
                              className="object-cover rounded"
                            />
                            <span className="font-medium">{item.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="bg-muted px-3 py-1 rounded-full">
                            {item.qty}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${item.price}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cart Summary */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(Number(cart.itemsPrice))}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatCurrency(Number(cart.taxPrice))}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">{formatCurrency(Number(cart.shippingPrice))}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(Number(cart.totalPrice))}
                  </span>
                </div>
              </div>
            </>
          )}
          
          <div className="mt-8 text-center">
            <Button asChild size="lg">
              <Link href="/">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Start Shopping
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharedCartPage;
