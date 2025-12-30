import { getSharedWishlist } from '@/lib/actions/wishlist.actions';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingBag } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Shared Wishlist',
};

const SharedWishlistPage = async (props: {
  params: Promise<{ id: string }>;
}) => {
  const params = await props.params;
  const { id } = params;

  const wishlist = await getSharedWishlist(id);
  
  if (!wishlist) {
    notFound();
  }

  return (
    <div className="wrapper py-10">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="text-center border-b">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            <CardTitle className="text-2xl">Shared Wishlist</CardTitle>
          </div>
          <p className="text-muted-foreground">
            {wishlist.userName}&apos;s wishlist with {wishlist.items.length} {wishlist.items.length === 1 ? 'item' : 'items'}
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {wishlist.items.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">This wishlist is empty.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {wishlist.items.map((item) => (
                <Link 
                  key={item.productId} 
                  href={`/product/${item.slug}`}
                  className="group"
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-square relative bg-muted">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-lg font-bold text-primary mt-2">
                        ${item.price}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
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

export default SharedWishlistPage;
