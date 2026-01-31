'use client';

import { useRouter } from 'next/navigation';

const ViewAllProductsButton = () => {
  const router = useRouter();

  return (
    <div className='flex justify-center items-center my-6 sm:my-8'>
      <button
        onClick={() => router.push('/search')}
        className='gradient-btn px-6 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base w-full max-w-xs sm:max-w-none sm:w-auto'
      >
        View All Products
      </button>
    </div>
  );
};
export default ViewAllProductsButton;


