import { APP_NAME } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";
import Menu from "./menu";
import CategoriesDrawer from './categories-drawer';
import Search from './search';
import { getAllCategories } from '@/lib/actions/product.actions';

const Header = async () => {
  const categoriesData = await getAllCategories();
  // Convert to plain objects for client component
  const categories = categoriesData.map((c) => ({ category: c.category }));

  return (
    <header className="w-full border-b sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="wrapper flex-between gap-2">
        <div className="flex-start gap-1 sm:gap-2">
          <CategoriesDrawer />
          <Link href="/" className="flex-start">
            <Image
              priority={true}
              src="/images/logo.png"
              width={40}
              height={40}
              alt={`${APP_NAME} logo`}
              className="w-9 h-9 sm:w-12 sm:h-12"
            />
            <span className="hidden sm:block ml-2 text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200">
              {APP_NAME}
            </span>
          </Link>
        </div>
        <div className='hidden md:block flex-1 max-w-md mx-4'>
          <Search categories={categories} />
        </div>
        {/*menu for small screen   */}
        <Menu />
      </div>
    </header>
  );
};

export default Header;
