'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchIcon, ChevronDown, Check, Clock, TrendingUp, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSearchSuggestions } from '@/lib/actions/product.actions';
import Image from 'next/image';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';
import { formatCurrency } from '@/lib/utils';

interface SearchProps {
  categories: Array<{ category: string }>;
}
// Product suggestion type
interface ProductSuggestion {
  id: string;
  name: string;
  slug: string;
  category: string;
  brand: string;
  price: number;
  images: string[];
}

const RECENT_SEARCHES_KEY = 'vibe_recent_searches';
const MAX_RECENT_SEARCHES = 5;

const Search = ({ categories }: SearchProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Debounce search query to limit API calls
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {
        setRecentSearches([]);
      }
    }
  }, []);

  // Initialize from URL params
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'all';
    setSearchQuery(q);
    setSelectedCategory(category);
  }, [searchParams]);

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedQuery.length >= 1) {
        setIsLoading(true);
        try {
          const results = await getSearchSuggestions(debouncedQuery, selectedCategory);
          setSuggestions(results);
        } catch (error) {
          console.error('Error fetching suggestions:', error);
          setSuggestions([]);
        }
        setIsLoading(false);
      } else {
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, selectedCategory]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCategoryOpen(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }, [recentSearches]);

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const removeRecentSearch = (searchToRemove: string) => {
    const updated = recentSearches.filter(s => s !== searchToRemove);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setCategoryOpen(false);
    if (searchQuery) {
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      if (value !== 'all') params.set('category', value);
      router.push(`/search?${params.toString()}`);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
    }
    setSuggestionsOpen(false);
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    router.push(`/search?${params.toString()}`);
  };
  // Handle suggestion click. 
  const handleSuggestionClick = (suggestion: ProductSuggestion) => {
    saveRecentSearch(suggestion.name);
    setSuggestionsOpen(false);
    router.push(`/product/${suggestion.slug}`);
  };

  const handleRecentSearchClick = (search: string) => {
    setSearchQuery(search);
    setSuggestionsOpen(false);
    const params = new URLSearchParams();
    params.set('q', search);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    router.push(`/search?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + (searchQuery.length === 0 ? recentSearches.length : 0);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      if (searchQuery.length > 0 && suggestions[highlightedIndex]) {
        handleSuggestionClick(suggestions[highlightedIndex]);
      } else if (searchQuery.length === 0 && recentSearches[highlightedIndex]) {
        handleRecentSearchClick(recentSearches[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setSuggestionsOpen(false);
      inputRef.current?.blur();
    }
  };

  const allCategories = [
    { category: 'all', label: 'All' },
    ...categories.map((c) => ({ category: c.category, label: c.category })),
  ];

  const showSuggestions = suggestionsOpen && (suggestions.length > 0 || isLoading || (searchQuery.length === 0 && recentSearches.length > 0) || (searchQuery.length > 0 && !isLoading));

  return (
    <form onSubmit={handleSearch} className='w-full'>
      <div className='flex w-full items-center gap-2'>
        {/* Category Dropdown */}
        <motion.div
          ref={dropdownRef}
          animate={categoryOpen ? 'open' : 'closed'}
          className='relative flex-shrink-0'
        >
          <motion.button
            type='button'
            onClick={() => setCategoryOpen((pv) => !pv)}
            className='flex items-center justify-between gap-1 sm:gap-2 px-2 sm:px-3 py-2 w-[100px] sm:w-[120px] md:w-[140px] rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-xs sm:text-sm h-9'
          >
            <span className='font-medium truncate'>
              {selectedCategory === 'all' ? 'All' : selectedCategory}
            </span>
            <motion.span variants={iconVariants} className='flex-shrink-0'>
              <ChevronDown className='h-3 w-3 sm:h-4 sm:w-4' />
            </motion.span>
          </motion.button>

          <AnimatePresence>
            {categoryOpen && (
              <motion.ul
                initial='closed'
                animate='open'
                exit='closed'
                variants={wrapperVariants}
                style={{ originY: 'top' }}
                className='flex flex-col gap-1 p-2 rounded-lg bg-background border border-input shadow-xl absolute top-[110%] left-0 w-[160px] sm:w-[180px] overflow-hidden z-50 max-h-[50vh] overflow-y-auto'
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

        {/* Search Input with Suggestions */}
        <div className='relative flex-1' ref={suggestionsRef}>
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={handleKeyDown}
            type='text'
            placeholder='Search...'
            className='flex-1 min-w-0 h-9 text-sm pr-8'
            autoComplete='off'
          />
          
          {/* Clear button */}
          {searchQuery && (
            <button
              type='button'
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
            >
              <X className='h-4 w-4' />
            </button>
          )}

          {/* Suggestions Dropdown */}
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className='absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto'
              >
                {/* Loading State */}
                {isLoading && (
                  <div className='flex items-center justify-center p-4'>
                    <div className='h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin' />
                  </div>
                )}

                {/* Recent Searches (when input is empty) */}
                {!isLoading && searchQuery.length === 0 && recentSearches.length > 0 && (
                  <div className='p-2'>
                    <div className='flex items-center justify-between px-2 py-1.5'>
                      <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                        Recent Searches
                      </span>
                      <button
                        type='button'
                        onClick={clearRecentSearches}
                        className='text-xs text-muted-foreground hover:text-primary transition-colors'
                      >
                        Clear all
                      </button>
                    </div>
                    {recentSearches.map((search, index) => (
                      <div
                        key={search}
                        className={`flex items-center justify-between group px-2 py-2 rounded-md cursor-pointer transition-colors ${
                          highlightedIndex === index ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                        onClick={() => handleRecentSearchClick(search)}
                      >
                        <div className='flex items-center gap-3'>
                          <Clock className='h-4 w-4 text-muted-foreground' />
                          <span className='text-sm'>{search}</span>
                        </div>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentSearch(search);
                          }}
                          className='opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity'
                        >
                          <X className='h-3.5 w-3.5' />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Product Suggestions */}
                {!isLoading && suggestions.length > 0 && (
                  <div className='p-2'>
                    {searchQuery.length > 0 && (
                      <div className='flex items-center gap-2 px-2 py-1.5 mb-1'>
                        <TrendingUp className='h-3.5 w-3.5 text-muted-foreground' />
                        <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                          Suggestions
                        </span>
                      </div>
                    )}
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          highlightedIndex === index ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {/* Product Image */}
                        <div className='relative h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-muted'>
                          <Image
                            src={suggestion.images[0] || '/images/placeholder.png'}
                            alt={suggestion.name}
                            fill
                            className='object-cover'
                            sizes='40px'
                          />
                        </div>
                        
                        {/* Product Info */}
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-medium truncate'>
                            {highlightText(suggestion.name, searchQuery)}
                          </p>
                          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                            <span className='truncate'>{suggestion.category}</span>
                            <span>•</span>
                            <span className='text-primary font-semibold'>
                              {formatCurrency(suggestion.price)}
                            </span>
                          </div>
                        </div>

                        {/* Arrow indicator */}
                        <SearchIcon className='h-4 w-4 text-muted-foreground flex-shrink-0' />
                      </div>
                    ))}
                    
                    {/* View all results link */}
                    <Link
                      href={`/search?q=${encodeURIComponent(searchQuery)}${selectedCategory !== 'all' ? `&category=${selectedCategory}` : ''}`}
                      className='flex items-center justify-center gap-2 p-2 mt-1 text-sm text-primary hover:bg-primary/5 rounded-md transition-colors'
                      onClick={() => {
                        saveRecentSearch(searchQuery);
                        setSuggestionsOpen(false);
                      }}
                    >
                      <SearchIcon className='h-4 w-4' />
                      <span>View all results for &quot;{searchQuery}&quot;</span>
                    </Link>
                  </div>
                )}

                {/* No results */}
                {!isLoading && searchQuery.length > 0 && suggestions.length === 0 && (
                  <div className='p-4 text-center'>
                    <p className='text-sm text-muted-foreground'>
                      No products found for &quot;{searchQuery}&quot;
                    </p>
                    <Link
                      href={`/search?q=${encodeURIComponent(searchQuery)}`}
                      className='text-sm text-primary hover:underline mt-1 inline-block'
                      onClick={() => setSuggestionsOpen(false)}
                    >
                      Search anyway
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button type='submit' size='icon' className='h-9 w-9 flex-shrink-0'>
          <SearchIcon className='h-4 w-4' />
        </Button>
      </div>
    </form>
  );
};

// Highlight matching text in suggestions
function highlightText(text: string, query: string) {
  if (!query) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className='bg-primary/20 text-primary font-semibold'>
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

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
