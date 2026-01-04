'use client';

import { ChevronDown, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
}

interface StaggeredDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  label?: string;
}

const StaggeredDropdown = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className,
  buttonClassName,
  menuClassName,
  label,
}: StaggeredDropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
  };

  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = selectedOption?.label || placeholder;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && (
        <span className='text-muted-foreground text-sm whitespace-nowrap'>
          {label}
        </span>
      )}
      <motion.div
        ref={dropdownRef}
        animate={open ? 'open' : 'closed'}
        className='relative'
      >
        <motion.button
          type='button'
          onClick={() => setOpen((pv) => !pv)}
          className={cn(
            'flex items-center justify-between gap-2 px-3 py-2 min-w-[120px] rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm h-9',
            buttonClassName
          )}
        >
          <span className='font-medium truncate capitalize'>{displayText}</span>
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
              className={cn(
                'flex flex-col gap-1 p-2 rounded-lg bg-background border border-input shadow-xl absolute top-[110%] left-0 min-w-[140px] overflow-hidden z-50',
                menuClassName
              )}
            >
              {options.map((option) => (
                <Option
                  key={option.value}
                  text={option.label}
                  value={option.value}
                  isSelected={value === option.value}
                  onSelect={handleSelect}
                />
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
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
      className={cn(
        'flex items-center justify-between gap-2 w-full p-2 text-sm font-medium whitespace-nowrap rounded-md hover:bg-primary/10 transition-colors cursor-pointer',
        isSelected ? 'bg-primary/10 text-primary' : 'text-foreground'
      )}
    >
      <div className='flex items-center gap-2'>
        <motion.span
          variants={actionIconVariants}
          className='w-4 h-4 flex items-center justify-center'
        >
          {isSelected && <Check className='h-4 w-4' />}
        </motion.span>
        <span className='capitalize'>{text}</span>
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

export default StaggeredDropdown;
