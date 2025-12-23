import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import ProductPrice from "./product-price";
import { Product } from "@/types";
import Rating from './rating';
import AddToWishlist from './add-to-wishlist';
import { getMyWishlist } from '@/lib/actions/wishlist.actions';

// display the products in a card
const ProductCard = async ({ product }: { product: Product }) => {
  const wishlist = await getMyWishlist();

  return (
    <Card className="w-full max-w-sm relative">
      <div className='absolute top-2 right-2 z-10'>
        <AddToWishlist
          wishlist={wishlist}
          item={{
            productId: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            image: product.images![0],
          }}
        />
      </div>
      <CardHeader className="p-0 items-center">
        <Link href={`/product/${product.slug}`}>
          <Image
            priority={true}
            src={product.images![0]}
            alt={product.name}
            className="aspect-square object-cover rounded"
            height={300}
            width={300}
          />
        </Link>
      </CardHeader>

      <CardContent className="p-2 grid gap-4">
        <div className="text-xs">{product.brand}</div>
        <Link href={`/product/${product.slug}`}>
          <h2 className="text-lg font-semibold hover:underline">
            {product.name}
          </h2>
        </Link>
        <div className="flex-between gap-2">
          <Rating value={Number(product.rating)} />
          {product.stock > 0 ? (
            <ProductPrice value={product.price} className="text-2xl" />
          ) : (
            <p className="text-destructive">Out of Stock</p>
          )}
        </div>
      </CardContent>
    </Card>
    
  );
};

export default ProductCard;
