import { notFound } from "next/navigation";
import ProductPrice from "@/components/shared/product/product-price";
import { Card, CardContent } from "@/components/ui/card";
import { getProductBySlug } from "@/lib/actions/product.actions";
// import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductImages from "@/components/shared/product/product-images";
import AddToCart from "@/components/shared/product/add-to-cart";
import { getMyCart } from "@/lib/actions/cart.actions";
import { round2 } from "@/lib/utils";

const ProductDetailsPage = async (props: {
  params: Promise<{ slug: string }>;
}) => {
  const params = await props.params;
  const { slug } = params;

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const cart = await getMyCart();

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
        {/* Images Column */}
        <div className="col-span-2 bg-muted rounded-xl min-h-[300px] flex items-center justify-center">
          {/* You can place an Image gallery component here */}
          <span className="text-muted-foreground">
            {" "}
            <ProductImages images={product.images!} />
          </span>
        </div>

        {/* Details Column */}
        <div className="col-span-3 md:col-span-2 flex flex-col gap-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {product.brand} &bull; {product.category}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {product.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {product.rating} out of {product.numReviews} reviews
            </p>
          </div>

          <div className="mt-4">
            <ProductPrice
              value={Number(product.price)}
              className="inline-block rounded-full bg-green-100 text-green-700 text-lg font-semibold px-6 py-2"
            />
          </div>

          <div className="mt-8 space-y-2">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="text-muted-foreground">{product.description}</p>
          </div>
        </div>

        {/* Action Column */}
        <div className="md:col-span-1">
          <Card className="shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Price
                </span>
                <ProductPrice value={Number(product.price)} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Status
                </span>
                {product.stock > 0 ? (
                  <Badge variant="outline">In stock</Badge>
                ) : (
                  <Badge variant="destructive">Out of stock!</Badge>
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
    </section>
  );
};

export default ProductDetailsPage;
