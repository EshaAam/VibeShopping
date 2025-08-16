import { Button } from "@/components/ui/button";
import ModeToggle from "./mode-toggle";
import { EllipsisVertical, ShoppingCart, UserIcon } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import UserButton from "./user-button";

const Menu = () => {
    return (<div className="flex justify-end gap-3">
        <nav className="hidden md:flex w-full max-w-xs gap-1">
            <ModeToggle/>
          <Button asChild variant="ghost">
            <Link href="/cart">
              <ShoppingCart />
              Cart
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
      <ModeToggle />
      <Button asChild variant='ghost'>
        <Link href='/cart'>
          <ShoppingCart />
          Cart
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