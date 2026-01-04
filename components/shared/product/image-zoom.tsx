'use client';

import { useState, useRef, MouseEvent } from 'react';
import Image from 'next/image';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface ImageZoomProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageZoom({ src, alt, isOpen, onClose }: ImageZoomProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 1));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.2, 4));
    } else {
      setScale((prev) => {
        const newScale = Math.max(prev - 0.2, 1);
        if (newScale === 1) {
          setPosition({ x: 0, y: 0 });
        }
        return newScale;
      });
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none">
        <DialogTitle className="sr-only">Image Zoom View</DialogTitle>
        {/* Controls */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="bg-white/20 hover:bg-white/30 text-white"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white text-sm min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="bg-white/20 hover:bg-white/30 text-white"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleReset}
            className="bg-white/20 hover:bg-white/30 text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleClose}
            className="bg-white/20 hover:bg-white/30 text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Image container */}
        <div
          ref={containerRef}
          className="w-full h-full flex items-center justify-center overflow-hidden cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
          >
            <Image
              src={src}
              alt={alt}
              width={1200}
              height={1200}
              className="max-w-full max-h-[85vh] object-contain select-none"
              draggable={false}
              priority
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
          Scroll to zoom • Drag to pan • Click outside to close
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImageZoom;
