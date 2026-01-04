'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import StaggeredDropdown, { DropdownOption } from '@/components/shared/staggered-dropdown';

const sortOptions: DropdownOption[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'lowest', label: 'Lowest Price' },
  { value: 'highest', label: 'Highest Price' },
  { value: 'rating', label: 'Top Rated' },
];

interface SortDropdownProps {
  currentSort: string;
}

const SortDropdown = ({ currentSort }: SortDropdownProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    params.set('page', '1'); // Reset to first page when sorting changes
    router.push(`/search?${params.toString()}`);
  };

  return (
    <StaggeredDropdown
      label='Sort by:'
      options={sortOptions}
      value={currentSort}
      onChange={handleSortChange}
      buttonClassName='min-w-[140px]'
    />
  );
};

export default SortDropdown;
