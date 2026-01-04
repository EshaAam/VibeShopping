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
    <header className="w-full border-b">
      <div className="wrapper flex-between">
        <div className="flex-start">
          <CategoriesDrawer />
          <Link href="/" className="flex-start ml-4">
            <Image
              priority={true}
              src="/images/logo.png"
              width={48}
              height={48}
              alt={`${APP_NAME} logo`}
            />
            <span className="hidden md:block lg:block ml-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
              {APP_NAME}
            </span>
          </Link>
        </div>
        <div className='hidden md:block'>
          <Search categories={categories} />
        </div>
        {/*menu for small screen   */}
        <Menu />
      </div>
    </header>
  );
};

export default Header;
