'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import ProductPrice from './product-price';
import { Product, Wishlist } from '@/types';
import Rating from './rating';
import AddToWishlist from './add-to-wishlist';
import {
  CardContainer,
  CardBody,
  CardItem,
} from '@/components/3d-card-effect';

// display the products in a card with 3D effect
const ProductCard = ({
  product,
  wishlist,
}: {
  product: Product;
  wishlist?: Wishlist;
}) => {
  return (
    <CardContainer containerClassName='py-0' className='w-full'>
      <CardBody className='w-full h-auto'>
        <Card className='w-full relative group overflow-hidden'>
          <CardItem
            translateZ={30}
            className='absolute top-1 right-1 sm:top-2 sm:right-2 z-10'
          >
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
          </CardItem>
          <CardHeader className='p-0 items-center'>
            <Link href={`/product/${product.slug}`} className='w-full'>
              <CardItem translateZ={50} className='w-full'>
                <div className='relative w-full aspect-square overflow-hidden rounded-t'>
                  <Image
                    priority={true}
                    src={product.images![0]}
                    alt={product.name}
                    fill
                    sizes='(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                    className='object-contain p-2 transition-transform duration-300 group-hover:scale-105'
                  />
                </div>
              </CardItem>
            </Link>
          </CardHeader>

          <CardContent className='p-2 sm:p-3 grid gap-1 sm:gap-2'>
            <CardItem translateZ={20} className='w-full'>
              <div className='text-[10px] sm:text-xs text-muted-foreground truncate'>{product.brand}</div>
            </CardItem>
            <CardItem translateZ={30} className='w-full'>
              <Link href={`/product/${product.slug}`}>
                <h2 className='text-xs sm:text-sm md:text-base font-semibold hover:underline line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]'>
                  {product.name}
                </h2>
              </Link>
            </CardItem>
            <CardItem translateZ={40} className='w-full'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1'>
                <Rating value={Number(product.rating)} size={14} className="hidden sm:flex" />
                <Rating value={Number(product.rating)} size={12} className="flex sm:hidden" />
                {product.stock > 0 ? (
                  <ProductPrice
                    value={product.price}
                    className='text-sm sm:text-lg font-bold'
                  />
                ) : (
                  <p className='text-destructive text-xs sm:text-sm'>Out of Stock</p>
                )}
              </div>
            </CardItem>
          </CardContent>
        </Card>
      </CardBody>
    </CardContainer>
  );
};

export default ProductCard;
