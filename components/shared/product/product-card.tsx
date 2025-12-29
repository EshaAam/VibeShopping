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
    <Card className="w-full relative group">
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
        <Link href={`/product/${product.slug}`} className="w-full">
          <div className="relative w-full aspect-square overflow-hidden rounded-t">
            <Image
              priority={true}
              src={product.images![0]}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain p-2 transition-transform group-hover:scale-105"
            />
          </div>
        </Link>
      </CardHeader>

      <CardContent className="p-3 grid gap-2">
        <div className="text-xs text-muted-foreground">{product.brand}</div>
        <Link href={`/product/${product.slug}`}>
          <h2 className="text-sm sm:text-base font-semibold hover:underline line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </h2>
        </Link>
        <div className="flex-between gap-2">
          <Rating value={Number(product.rating)} size={16} />
          {product.stock > 0 ? (
            <ProductPrice value={product.price} className="text-lg sm:text-xl" />
          ) : (
            <p className="text-destructive text-sm">Out of Stock</p>
          )}
        </div>
      </CardContent>
    </Card>
    
  );
};

export default ProductCard;
