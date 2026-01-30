import { notFound } from "next/navigation";
import ProductPrice from "@/components/shared/product/product-price";
import { Card, CardContent } from "@/components/ui/card";
import { getProductBySlug } from "@/lib/actions/product.actions";
// import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductImages from "@/components/shared/product/product-images";
import AddToCart from "@/components/shared/product/add-to-cart";
import { getMyCart } from "@/lib/actions/cart.actions";
import { getMyWishlist } from "@/lib/actions/wishlist.actions";
import { round2 } from "@/lib/utils";
import { auth } from '@/auth';
import ReviewList from './review-list';
import Rating from '@/components/shared/product/rating';
import AddToWishlist from '@/components/shared/product/add-to-wishlist';

const ProductDetailsPage = async (props: {
  params: Promise<{ slug: string }>;
}) => {
  const params = await props.params;
  const { slug } = params;

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const cart = await getMyCart();
  const wishlist = await getMyWishlist();

  const session = await auth();
  const userId = session?.user?.id;

  return (
    <section className="max-w-7xl mx-auto py-4 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10">
        {/* Images Column */}
        <div className="lg:col-span-2 bg-muted rounded-xl min-h-[250px] sm:min-h-[300px] flex items-center justify-center">
          {/* You can place an Image gallery component here */}
          <span className="text-muted-foreground">
            {" "}
            <ProductImages images={product.images!} />
          </span>
        </div>

        {/* Details Column */}
        <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-6">
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {product.brand} &bull; {product.category}
            </p>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              {product.name}
            </h1>
            <Rating value={Number(product.rating)} />
            <p className="text-xs sm:text-sm text-muted-foreground">{product.numReviews} reviews</p>
          </div>

          <div className="mt-2 sm:mt-4">
            <ProductPrice
              value={Number(product.price)}
              className="inline-block rounded-full bg-green-100 text-green-700 text-base sm:text-lg font-semibold px-4 sm:px-6 py-1.5 sm:py-2"
            />
          </div>

          <div className="mt-4 sm:mt-8 space-y-2">
            <h2 className="text-base sm:text-lg font-semibold">Description</h2>
            <p className="text-sm sm:text-base text-muted-foreground">{product.description}</p>
          </div>
        </div>

        {/* Action Column */}
        <div className="lg:col-span-1">
          <Card className="shadow-lg sticky top-20">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Price
                </span>
                <div className="flex items-center gap-2">
                  <ProductPrice value={Number(product.price)} className="text-lg sm:text-xl" />
                  <AddToWishlist
                    wishlist={wishlist}
                    item={{
                      productId: product.id,
                      name: product.name,
                      slug: product.slug,
                      price: round2(product.price).toFixed(2),
                      image: product.images?.[0] || "",
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Status
                </span>
                {product.stock > 0 ? (
                  <Badge variant="outline" className="text-xs">In stock</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">Out of stock!</Badge>
                )}
              </div>
              {product.stock > 0 && (
                <AddToCart
                  cart={cart}
                  item={{
                    productId: product.id,
                    name: product.name,
                    slug: product.slug,
                    price: round2(product.price).toFixed(2),
                    qty: 1,
                    image: product.images?.[0] || "",
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <section className='mt-10'>
        <h2 className='h2-bold  mb-5'>Customer Reviews</h2>
        <ReviewList
          productId={product.id}
          productSlug={product.slug}
          userId={userId || ''}
        />
      </section>
    </section>
  );
};

export default ProductDetailsPage;
