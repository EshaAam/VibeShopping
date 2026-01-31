import { Button } from "@/components/ui/button";
import ModeToggle from "./mode-toggle";
import { EllipsisVertical, Heart, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import UserButton from "./user-button";
import Search from './search';
import { getMyCart } from "@/lib/actions/cart.actions";
import { getMyWishlist } from "@/lib/actions/wishlist.actions";
import { getAllCategories } from "@/lib/actions/product.actions";
import { Badge } from "@/components/ui/badge";

const Menu = async () => {
    const cart = await getMyCart();
    const wishlist = await getMyWishlist();
    const categoriesData = await getAllCategories();
    // Convert to plain objects for client component
    const categories = categoriesData.map((c) => ({ category: c.category }));
    
    const cartItemsCount = cart?.items.reduce((acc, item) => acc + item.qty, 0) || 0;
    const wishlistItemsCount = wishlist?.items.length || 0;

    return (<div className="flex justify-end items-center gap-2">
        <nav className="hidden md:flex w-full max-w-xs gap-1">
            <ModeToggle/>
          <Button asChild variant="ghost" className="relative">
            <Link href="/wishlist">
              <Heart />
              Wishlist
              {wishlistItemsCount > 0 && (
                <Badge className="absolute -top-0 -right-0 h-4 w-4 p-0 flex items-center justify-center text-xs">
                  {wishlistItemsCount}
                </Badge>
              )}
            </Link>
          </Button>
          <Button asChild variant="ghost" className="relative">
            <Link href="/cart">
              <ShoppingCart />
              Cart
              {cartItemsCount > 0 && (
                <Badge className="absolute -top-0 -right-0 h-4 w-4 p-0 flex items-center justify-center text-xs">
                  {cartItemsCount}
                </Badge>
              )}
            </Link>
          </Button>
          {/* <Button asChild>
            <Link href="/sign-in">
              <UserIcon />
              Login
            </Link>
          </Button> */}
          <UserButton />

        </nav>
        {/* for small screen navbar - profile button before menu */}
        <nav className='md:hidden flex items-center gap-1'>
          <UserButton />
          <Sheet>
            <SheetTrigger className='align-middle p-2 hover:bg-accent rounded-md transition-colors'>
              <EllipsisVertical className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent className='flex flex-col w-[85vw] max-w-sm'>
              <SheetTitle className="text-xl font-bold mb-2">Menu</SheetTitle>
              <div className='mt-4 w-full'>
                <Search categories={categories} />
              </div>
              <div className="flex flex-col gap-2 mt-6 w-full">
                <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-accent">
                  <span className="text-sm font-medium">Theme</span>
                  <ModeToggle />
                </div>
                <Link href='/wishlist' className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <Heart className="h-5 w-5" />
                    <span className="text-sm font-medium">Wishlist</span>
                  </div>
                  {wishlistItemsCount > 0 && (
                    <Badge className="h-6 min-w-[24px] px-2 flex items-center justify-center text-xs">
                      {wishlistItemsCount}
                    </Badge>
                  )}
                </Link>
                <Link href='/cart' className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-5 w-5" />
                    <span className="text-sm font-medium">Cart</span>
                  </div>
                  {cartItemsCount > 0 && (
                    <Badge className="h-6 min-w-[24px] px-2 flex items-center justify-center text-xs">
                      {cartItemsCount}
                    </Badge>
                  )}
                </Link>
              </div>
              <SheetDescription></SheetDescription>
            </SheetContent>
          </Sheet>
        </nav>
    </div>  );
}
 
export default Menu;