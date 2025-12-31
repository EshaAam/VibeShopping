'use client';

import { useRouter } from 'next/navigation';

const ViewAllProductsButton = () => {
  const router = useRouter();

  return (
    <div className='flex justify-center items-center my-8'>
      <button
        onClick={() => router.push('/search')}
        className='gradient-btn px-8 py-3 text-base'
      >
        View All Products
      </button>
    </div>
  );
};
export default ViewAllProductsButton;


