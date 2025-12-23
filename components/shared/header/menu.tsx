import { Button } from "@/components/ui/button";
import ModeToggle from "./mode-toggle";
import { EllipsisVertical, Heart, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import UserButton from "./user-button";
import Search from './search';
import { getMyCart } from "@/lib/actions/cart.actions";
import { getMyWishlist } from "@/lib/actions/wishlist.actions";
import { Badge } from "@/components/ui/badge";

const Menu = async () => {
    const cart = await getMyCart();
    const wishlist = await getMyWishlist();
    
    const cartItemsCount = cart?.items.reduce((acc, item) => acc + item.qty, 0) || 0;
    const wishlistItemsCount = wishlist?.items.length || 0;

    return (<div className="flex justify-end gap-3">
        <nav className="hidden md:flex w-full max-w-xs gap-1">
            <ModeToggle/>
          <Button asChild variant="ghost" className="relative">
            <Link href="/wishlist">
              <Heart />
              Wishlist
              {wishlistItemsCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
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
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
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
        {/* for small screen navbar */}
        <nav className='md:hidden'>
  <Sheet>
    <SheetTrigger className='align-middle'>
      <EllipsisVertical />
    </SheetTrigger>
    <SheetContent className='flex flex-col items-start'>
      <SheetTitle>Menu</SheetTitle>
      <div className='mt-10'>
        <Search />
      </div>
      <ModeToggle />
      <Button asChild variant='ghost' className="relative">
        <Link href='/wishlist'>
          <Heart />
          Wishlist
          {wishlistItemsCount > 0 && (
            <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {wishlistItemsCount}
            </Badge>
          )}
        </Link>
      </Button>
      <Button asChild variant='ghost' className="relative">
        <Link href='/cart'>
          <ShoppingCart />
          Cart
          {cartItemsCount > 0 && (
            <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {cartItemsCount}
            </Badge>
          )}
        </Link>
      </Button>
       {/* <Button asChild>
        <Link href='/sign-in'>
          <UserIcon />
          Sign In
        </Link>
      </Button> */}
      <UserButton />
      <SheetDescription></SheetDescription>
    </SheetContent>
  </Sheet>
</nav>

    </div>  );
}
 
export default Menu;