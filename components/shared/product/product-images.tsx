'use client';
import Image from 'next/image';

import { cn } from '@/lib/utils';
import { useState } from 'react';

const ProductImages = ({ images }: { images: string[] }) => {
  const [current, setCurrent] = useState(0);

  return (
    <div className='space-y-4'>
      <Image
        src={images![current]}
        alt='hero image'
        width={1000}
        height={1000}
        className='min-h-[300px] object-cover object-center '
      />
      <div className='flex'>
        {images.map((image, index)=>(
            <div key={image} onClick={()=> setCurrent(index)} className=''>
                <Image
                  src={image}
                  alt={`Product image ${index + 1}`}
                  width={100}
                  height={100}
                  className={cn(
                    'cursor-pointer object-cover object-center rounded-md',
                    current === index ? 'border-2 border-blue-500' : 'border'
                  )}
                />

            </div>
        ))}
      </div>
    </div>
  );
};

export default ProductImages;