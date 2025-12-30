'use client';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';

const ProductImages = ({ images }: { images: string[] }) => {
  const [current, setCurrent] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setZoomPosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsZooming(true);
  };

  const handleMouseLeave = () => {
    setIsZooming(false);
  };

  return (
    <div className='space-y-4'>
      {/* Main Image with Hover Zoom */}
      <div 
        ref={imageContainerRef}
        className='relative overflow-hidden rounded-lg cursor-crosshair'
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Image
          src={images![current]}
          alt='hero image'
          width={1000}
          height={1000}
          className='min-h-[300px] object-cover object-center'
          style={{ 
            width: '100%', 
            height: 'auto', 
            maxHeight: '600px',
            transform: isZooming ? 'scale(2)' : 'scale(1)',
            transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
            transition: isZooming ? 'none' : 'transform 0.3s ease-out',
          }}
        />
        
        {/* Zoom indicator */}
        {!isZooming && (
          <div className='absolute bottom-3 right-3 bg-black/50 text-white px-2 py-1 rounded text-xs'>
            Hover to zoom
          </div>
        )}
      </div>

      {/* Thumbnail Images */}
      <div className='flex gap-2'>
        {images.map((image, index) => (
          <div 
            key={image} 
            onClick={() => setCurrent(index)} 
            className='relative'
          >
            <Image
              src={image}
              alt={`Product image ${index + 1}`}
              width={100}
              height={100}
              className={cn(
                'cursor-pointer object-cover object-center rounded-md transition-all duration-200',
                current === index 
                  ? 'border-2 border-primary ring-2 ring-primary/20' 
                  : 'border border-muted-foreground/20 hover:border-primary/50'
              )}
              style={{ width: '100px', height: '100px' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductImages;