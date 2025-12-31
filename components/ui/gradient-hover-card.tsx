'use client';

import React, { useRef } from 'react';

interface GradientHoverCardProps {
  children: React.ReactNode;
  className?: string;
}

const GradientHoverCard = ({ children, className }: GradientHoverCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !glowRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    glowRef.current.style.left = `${x}px`;
    glowRef.current.style.top = `${y}px`;
    glowRef.current.style.opacity = '1';
  };

  const handleMouseLeave = () => {
    if (glowRef.current) {
      glowRef.current.style.opacity = '0';
    }
  };

  return (
    <div className={`relative group ${className || ''}`}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className='relative overflow-hidden rounded-2xl transition-all duration-300'
        style={{
          background: 'linear-gradient(135deg, #FF9ECE 0%, #FFCC99 50%, #C287FA 100%)',
        }}
      >
        {/* Mouse tracking glow */}
        <div
          ref={glowRef}
          className='absolute w-64 h-64 pointer-events-none transition-opacity duration-300 z-10'
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 30%, transparent 60%)',
            transform: 'translate(-50%, -50%)',
            filter: 'blur(30px)',
            opacity: 0,
          }}
        />

        {/* Card content */}
        <div className='relative p-6 z-20'>
          {children}
        </div>
      </div>
    </div>
  );
};

export default GradientHoverCard;
