import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { getAllCategories } from '@/lib/actions/product.actions';
import { Button } from '@/components/ui/button';
import { MenuIcon } from 'lucide-react';
import Link from 'next/link';

const CategoriesDrawer = async () => {
  const categories = await getAllCategories();

  return (
    <Drawer direction='left'>
      <DrawerTrigger asChild>
        <Button variant='outline' size='icon' className='h-9 w-9 sm:h-10 sm:w-10'>
          <MenuIcon className='h-4 w-4 sm:h-5 sm:w-5' />
        </Button>
      </DrawerTrigger>
      <DrawerContent className='h-full w-[280px] sm:w-[320px] max-w-[85vw]'>
        <DrawerHeader className='border-b pb-4'>
          <DrawerTitle className='text-lg font-bold'>Categories</DrawerTitle>
        </DrawerHeader>
        <div className='p-4 space-y-1 overflow-y-auto'>
          {categories.map((x) => (
            <Button
              className='w-full justify-between h-11 text-sm'
              variant='ghost'
              key={x.category}
              asChild
            >
              <DrawerClose asChild>
                <Link href={`/search?category=${x.category}`}>
                  <span className='truncate'>{x.category}</span>
                  <span className='text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded-full'>
                    {x._count}
                  </span>
                </Link>
              </DrawerClose>
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CategoriesDrawer;
