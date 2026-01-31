"use client";

import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Product } from "@/types";
import Link from "next/link";
import Image from "next/image";

export function ProductCarousel({ data }: { data: Product[] }) {
  // Filter products that have banner images
  const productsWithBanners = data.filter(
    (product) => product.banner && product.banner.trim() !== ""
  );

  if (productsWithBanners.length === 0) return null;

  return (
    <Carousel
      className="w-full mb-8 sm:mb-12"
      opts={{
        loop: true,
      }}
      plugins={[
        Autoplay({
          delay: 3000,
          stopOnInteraction: false,
          stopOnMouseEnter: false,
        }),
      ]}
    >
      <CarouselContent>
        {productsWithBanners.map((product: Product) => (
          <CarouselItem key={product.id}>
            <Link href={`/product/${product.slug}`}>
              <div className="relative mx-auto h-44 sm:h-56 md:h-64 lg:h-80 rounded-xl overflow-hidden">
                {product.banner && (
                  <Image
                    alt={product.name}
                    src={product.banner}
                    fill
                    sizes="100vw"
                    className="object-cover"
                    priority
                  />
                )}
              </div>
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-2 sm:left-4 h-8 w-8 sm:h-10 sm:w-10 opacity-70 hover:opacity-100" />
      <CarouselNext className="right-2 sm:right-4 h-8 w-8 sm:h-10 sm:w-10 opacity-70 hover:opacity-100" />
    </Carousel>
  );
}
