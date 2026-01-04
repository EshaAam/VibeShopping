'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchIcon, ChevronDown, Check } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchProps {
  categories: Array<{ category: string }>;
}

const Search = ({ categories }: SearchProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize from URL params
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'all';
    setSearchQuery(q);
    setSelectedCategory(category);
  }, [searchParams]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setOpen(false);
    // Automatically navigate when category changes
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (value !== 'all') params.set('category', value);
    router.push(`/search?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    router.push(`/search?${params.toString()}`);
  };

  const allCategories = [
    { category: 'all', label: 'All' },
    ...categories.map((c) => ({ category: c.category, label: c.category })),
  ];

  return (
    <form onSubmit={handleSearch}>
      <div className='flex w-full max-w-sm items-center space-x-2'>
        {/* Staggered Dropdown */}
        <motion.div
          ref={dropdownRef}
          animate={open ? 'open' : 'closed'}
          className='relative'
        >
          <motion.button
            type='button'
            onClick={() => setOpen((pv) => !pv)}
            className='flex items-center justify-between gap-2 px-3 py-2 w-[140px] rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm h-9'
          >
            <span className='font-medium truncate'>
              {selectedCategory === 'all' ? 'All' : selectedCategory}
            </span>
            <motion.span variants={iconVariants} className='flex-shrink-0'>
              <ChevronDown className='h-4 w-4' />
            </motion.span>
          </motion.button>

          <AnimatePresence>
            {open && (
              <motion.ul
                initial='closed'
                animate='open'
                exit='closed'
                variants={wrapperVariants}
                style={{ originY: 'top' }}
                className='flex flex-col gap-1 p-2 rounded-lg bg-background border border-input shadow-xl absolute top-[110%] left-0 w-[180px] overflow-hidden z-50'
              >
                {allCategories.map((cat) => (
                  <Option
                    key={cat.category}
                    text={cat.label}
                    value={cat.category}
                    isSelected={selectedCategory === cat.category}
                    onSelect={handleCategoryChange}
                  />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.div>

        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type='text'
          placeholder='Search...'
          className='md:w-[100px] lg:w-[300px]'
        />
        <Button type='submit'>
          <SearchIcon />
        </Button>
      </div>
    </form>
  );
};

interface OptionProps {
  text: string;
  value: string;
  isSelected: boolean;
  onSelect: (value: string) => void;
}

const Option = ({ text, value, isSelected, onSelect }: OptionProps) => {
  return (
    <motion.li
      variants={itemVariants}
      onClick={() => onSelect(value)}
      className={`flex items-center justify-between gap-2 w-full p-2 text-sm font-medium whitespace-nowrap rounded-md hover:bg-primary/10 transition-colors cursor-pointer ${
        isSelected ? 'bg-primary/10 text-primary' : 'text-foreground'
      }`}
    >
      <div className='flex items-center gap-2'>
        <motion.span
          variants={actionIconVariants}
          className='w-4 h-4 flex items-center justify-center'
        >
          {isSelected && <Check className='h-4 w-4' />}
        </motion.span>
        <span>{text}</span>
      </div>
    </motion.li>
  );
};

// Animation variants
const wrapperVariants = {
  open: {
    scaleY: 1,
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.05,
    },
  },
  closed: {
    scaleY: 0,
    opacity: 0,
    transition: {
      when: 'afterChildren',
      staggerChildren: 0.05,
    },
  },
};

const iconVariants = {
  open: { rotate: 180 },
  closed: { rotate: 0 },
};

const itemVariants = {
  open: {
    opacity: 1,
    y: 0,
    transition: {
      when: 'beforeChildren',
    },
  },
  closed: {
    opacity: 0,
    y: -15,
    transition: {
      when: 'afterChildren',
    },
  },
};

const actionIconVariants = {
  open: { scale: 1, y: 0 },
  closed: { scale: 0, y: -7 },
};

export default Search;
